import type { LucideIcon } from 'lucide-react';
import {
  Activity,
  ArrowRight,
  BarChart3,
  Box,
  CheckSquare,
  CircuitBoard,
  ClipboardPaste,
  Copy,
  Crosshair,
  Download,
  Edit,
  FileCode,
  FileJson,
  FileText,
  FlipHorizontal2,
  Gauge,
  Grid3X3,
  History,
  Link,
  Maximize,
  MessageSquarePlus,
  Microscope,
  Monitor,
  Move,
  Package,
  Pentagon,
  Play,
  Plus,
  Printer,
  RefreshCw,
  RotateCw,
  Ruler,
  Search,
  Settings2,
  ShieldAlert,
  ShieldCheck,
  SlidersHorizontal,
  Sparkles,
  Trash2,
  Zap,
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
  | 'bom'
  | 'validation'
  | 'simulation'
  | 'starter_circuits'
  | 'model_3d'
  | 'serial'
  | 'exports'
  | 'firmware'
  | 'inventory';

/** What kind of target was right-clicked. */
export type TargetKind =
  | 'node'
  | 'wire'
  | 'pad'
  | 'via'
  | 'trace'
  | 'canvas'
  | 'bom_row'
  | 'issue'
  | 'probe'
  | 'starter_circuit'
  | 'log_line'
  | 'model'
  | 'file'
  | 'part';

export interface MenuPoint {
  x: number;
  y: number;
}

export interface MenuContext {
  /** Which view the menu was triggered from. */
  view: MenuContextType;
  /** What kind of element was clicked. */
  target: TargetKind;
  /** Optional ID of the clicked element. */
  targetId?: string;
  /** Optional label of the clicked element. */
  targetLabel?: string;
  /** Optional screen-space pointer position. */
  pointer?: MenuPoint;
}

export type RadialSlot = 0 | 1 | 2 | 3 | 4 | 5 | 6 | 7;

export type RadialCommandGroup = 'create' | 'transform' | 'connect' | 'inspect' | 'run' | 'delete' | 'edit' | 'reuse';

export interface RadialMenuItem {
  /** Unique action id. */
  id: string;
  /** Display label shown in the wheel. */
  label: string;
  /** Short supporting text shown in the center well on hover/focus. */
  description: string;
  /** Lucide icon component. */
  icon: LucideIcon;
  /** Stable compass slot. Slots never shift just because a context has fewer actions. */
  slot: RadialSlot;
  /** Semantic action group for color and mental model. */
  group: RadialCommandGroup;
  /** Optional keyboard or gesture hint. */
  hint?: string;
  /** Whether the item is currently disabled. */
  disabled?: boolean;
  /** Human-readable disabled reason for the center well. */
  disabledReason?: string;
  /** If true, show destructive styling. */
  destructive?: boolean;
  /** If true, user preferences may move this command to a different slot later. */
  customizable?: boolean;
}

export interface RadialCommandEventDetail {
  commandId: string;
  context: MenuContext;
  source: 'radial-menu';
  activation?: {
    sendNow?: boolean;
    input?: 'mouse' | 'keyboard' | 'marking';
    modifier?: 'shift';
  };
  handled?: boolean;
  undo?: {
    label: string;
    description?: string;
    run: () => void;
  };
}

export const RADIAL_COMMAND_EVENT = 'protopulse:radial-command';

export interface RadialCommandPreviewEventDetail {
  commandId?: string;
  context?: MenuContext;
  source: 'radial-menu';
  phase: 'show' | 'clear';
}

export const RADIAL_COMMAND_PREVIEW_EVENT = 'protopulse:radial-command-preview';

export const RADIAL_SLOT_COUNT = 8;

export type RadialCoverageLevel = 'full' | 'ready' | 'thin' | 'empty';

export interface RadialCoverageEntry {
  key: string;
  context: Pick<MenuContext, 'view' | 'target'>;
  viewLabel: string;
  targetLabel: string;
  commandCount: number;
  linearCommandCount: number;
  aiCommandCount: number;
  destructiveCount: number;
  usedSlotCount: number;
  emptySlotCount: number;
  emptySlotDirections: string[];
  coverageLevel: RadialCoverageLevel;
  commandIds: string[];
}

export const radialSlotMeta: Record<RadialSlot, { direction: string; label: string; group: RadialCommandGroup }> = {
  0: { direction: 'N', label: 'Create', group: 'create' },
  1: { direction: 'NE', label: 'Transform', group: 'transform' },
  2: { direction: 'E', label: 'Connect', group: 'connect' },
  3: { direction: 'SE', label: 'Inspect', group: 'inspect' },
  4: { direction: 'S', label: 'Run', group: 'run' },
  5: { direction: 'SW', label: 'Remove', group: 'delete' },
  6: { direction: 'W', label: 'Edit', group: 'edit' },
  7: { direction: 'NW', label: 'Reuse', group: 'reuse' },
};

// ---------------------------------------------------------------------------
// Action helpers
// ---------------------------------------------------------------------------

function action(item: RadialMenuItem): RadialMenuItem {
  return { customizable: true, ...item };
}

function sorted(actions: RadialMenuItem[]): RadialMenuItem[] {
  return [...actions].sort((a, b) => a.slot - b.slot);
}

export function isRadialAiCommand(item: Pick<RadialMenuItem, 'id' | 'label'>): boolean {
  return item.id.startsWith('ai_') || item.id === 'generate_architecture' || /\bAI\b/i.test(item.label);
}

export function dispatchRadialCommandDetail(
  detail: Omit<RadialCommandEventDetail, 'source'>,
): RadialCommandEventDetail {
  const eventDetail: RadialCommandEventDetail = { ...detail, source: 'radial-menu' };
  window.dispatchEvent(new CustomEvent<RadialCommandEventDetail>(RADIAL_COMMAND_EVENT, { detail: eventDetail }));
  return eventDetail;
}

export function dispatchRadialCommand(detail: Omit<RadialCommandEventDetail, 'source'>): boolean {
  const eventDetail = dispatchRadialCommandDetail(detail);
  return eventDetail.handled === true;
}

export function dispatchRadialCommandPreview(detail: Omit<RadialCommandPreviewEventDetail, 'source'>): void {
  window.dispatchEvent(
    new CustomEvent<RadialCommandPreviewEventDetail>(RADIAL_COMMAND_PREVIEW_EVENT, {
      detail: { ...detail, source: 'radial-menu' },
    }),
  );
}

export function getTargetSummary(context: MenuContext): string {
  if (context.targetLabel) {
    return context.targetLabel;
  }
  if (context.targetId) {
    return context.targetId;
  }
  switch (context.target) {
    case 'bom_row':
      return 'BOM row';
    case 'issue':
      return 'Validation issue';
    case 'starter_circuit':
      return 'Starter circuit';
    case 'log_line':
      return 'Serial log line';
    case 'model':
      return '3D object';
    case 'part':
      return 'Part';
    case 'canvas':
      return 'Canvas';
    default:
      return context.target;
  }
}

export function getViewSummary(context: MenuContext): string {
  switch (context.view) {
    case 'architecture':
      return 'Architecture';
    case 'schematic':
      return 'Schematic';
    case 'pcb':
      return 'PCB';
    case 'breadboard':
      return 'Breadboard';
    case 'bom':
      return 'BOM';
    case 'validation':
      return 'Validation';
    case 'simulation':
      return 'Simulation';
    case 'starter_circuits':
      return 'Starter Circuits';
    case 'model_3d':
      return '3D View';
    case 'serial':
      return 'Serial Monitor';
    case 'exports':
      return 'Exports';
    case 'firmware':
      return 'Firmware';
    case 'inventory':
      return 'Inventory';
  }
}

// ---------------------------------------------------------------------------
// Per-context action definitions
// ---------------------------------------------------------------------------

const architectureNodeActions: RadialMenuItem[] = sorted([
  action({
    id: 'add_to_bom',
    label: 'Add BOM',
    description: 'Create a BOM entry from this architecture block.',
    icon: Package,
    slot: 0,
    group: 'create',
    hint: 'N',
  }),
  action({
    id: 'change_type',
    label: 'Retype',
    description: 'Change the block category without losing placement.',
    icon: RefreshCw,
    slot: 1,
    group: 'transform',
    hint: 'NE',
  }),
  action({
    id: 'connect',
    label: 'Connect',
    description: 'Start a connection from this block.',
    icon: Link,
    slot: 2,
    group: 'connect',
    hint: 'E',
  }),
  action({
    id: 'ai_explain_architecture',
    label: 'Explain',
    description: 'Ask AI to explain this block, risks, and next moves.',
    icon: Microscope,
    slot: 3,
    group: 'inspect',
    hint: 'SE',
  }),
  action({
    id: 'analyze_architecture',
    label: 'Analyze',
    description: 'Run architecture analysis with this block selected.',
    icon: BarChart3,
    slot: 4,
    group: 'run',
    hint: 'S',
  }),
  action({
    id: 'delete',
    label: 'Delete',
    description: 'Remove this block and its connected edges.',
    icon: Trash2,
    slot: 5,
    group: 'delete',
    hint: 'SW',
    destructive: true,
  }),
  action({
    id: 'edit',
    label: 'Edit',
    description: 'Open the component editor or node inspector.',
    icon: Edit,
    slot: 6,
    group: 'edit',
    hint: 'W',
  }),
  action({
    id: 'duplicate',
    label: 'Duplicate',
    description: 'Clone this block near the current one.',
    icon: Copy,
    slot: 7,
    group: 'reuse',
    hint: 'NW',
  }),
]);

const architectureCanvasActions: RadialMenuItem[] = sorted([
  action({
    id: 'add_node',
    label: 'Add Node',
    description: 'Drop a new architecture block on the canvas.',
    icon: Plus,
    slot: 0,
    group: 'create',
    hint: 'N',
  }),
  action({
    id: 'generate_architecture',
    label: 'Generate',
    description: 'Ask the AI assistant to generate a starting architecture.',
    icon: Sparkles,
    slot: 1,
    group: 'transform',
    hint: 'NE',
  }),
  action({
    id: 'ai_propose_connection',
    label: 'AI Connect',
    description: 'Ask AI for the next useful architecture connection.',
    icon: Link,
    slot: 2,
    group: 'connect',
    hint: 'E',
  }),
  action({
    id: 'fit_view',
    label: 'Fit',
    description: 'Zoom the architecture canvas to fit the design.',
    icon: Maximize,
    slot: 3,
    group: 'inspect',
    hint: 'SE',
  }),
  action({
    id: 'analyze_architecture',
    label: 'Analyze',
    description: 'Open the design analysis panel.',
    icon: BarChart3,
    slot: 4,
    group: 'run',
    hint: 'S',
  }),
  action({
    id: 'run_validation',
    label: 'Validate',
    description: 'Open the Validation view for design checks.',
    icon: ShieldCheck,
    slot: 5,
    group: 'run',
    hint: 'SW',
  }),
  action({
    id: 'select_all',
    label: 'Select All',
    description: 'Select every architecture block.',
    icon: CheckSquare,
    slot: 6,
    group: 'edit',
    hint: 'W',
  }),
  action({
    id: 'paste',
    label: 'Paste',
    description: 'Paste architecture blocks from the clipboard.',
    icon: ClipboardPaste,
    slot: 7,
    group: 'reuse',
    hint: 'NW',
  }),
]);

const architectureQuickAddActions: RadialMenuItem[] = [
  action({
    id: 'add_mcu',
    label: 'Add MCU',
    description: 'Place a microcontroller Architecture block.',
    icon: Plus,
    slot: 0,
    group: 'create',
    hint: 'M',
  }),
  action({
    id: 'add_sensor',
    label: 'Add Sensor',
    description: 'Place a sensor Architecture block.',
    icon: Plus,
    slot: 0,
    group: 'create',
    hint: 'S',
  }),
  action({
    id: 'add_power',
    label: 'Add Power',
    description: 'Place a power Architecture block.',
    icon: Plus,
    slot: 0,
    group: 'create',
    hint: 'P',
  }),
  action({
    id: 'add_communication',
    label: 'Add Comms',
    description: 'Place a communication Architecture block.',
    icon: Plus,
    slot: 0,
    group: 'create',
    hint: 'C',
  }),
  action({
    id: 'add_connector',
    label: 'Add Connector',
    description: 'Place a connector Architecture block.',
    icon: Plus,
    slot: 0,
    group: 'create',
    hint: 'K',
  }),
];

const architectureLinearActions: RadialMenuItem[] = sorted([
  ...architectureQuickAddActions,
  ...architectureCanvasActions,
  action({
    id: 'ai_explain_architecture',
    label: 'AI Explain',
    description: 'Explain the current target or canvas in plain language.',
    icon: Microscope,
    slot: 3,
    group: 'inspect',
    hint: 'AI',
  }),
  action({
    id: 'ai_expand_block',
    label: 'AI Expand',
    description: 'Ask AI to break this architecture block into concrete sub-blocks.',
    icon: Sparkles,
    slot: 1,
    group: 'transform',
    hint: 'AI',
  }),
  action({
    id: 'toggle_grid',
    label: 'Toggle Grid',
    description: 'Toggle Architecture snap-to-grid placement.',
    icon: Grid3X3,
    slot: 1,
    group: 'transform',
    hint: 'G',
  }),
  action({
    id: 'copy_summary',
    label: 'Copy Summary',
    description: 'Copy a readable Architecture summary to the clipboard.',
    icon: FileText,
    slot: 7,
    group: 'reuse',
    hint: 'S',
  }),
  action({
    id: 'copy_json',
    label: 'Copy JSON',
    description: 'Copy raw Architecture graph JSON to the clipboard.',
    icon: FileJson,
    slot: 7,
    group: 'reuse',
    hint: 'J',
  }),
  action({
    id: 'edit_component',
    label: 'Edit Component',
    description: 'Open the Component Editor for the selected Architecture block.',
    icon: Edit,
    slot: 6,
    group: 'edit',
    hint: 'W',
  }),
  action({
    id: 'create_schematic_instance',
    label: 'Create Schematic',
    description: 'Place the selected Architecture block onto the schematic.',
    icon: CircuitBoard,
    slot: 2,
    group: 'connect',
    hint: 'E',
  }),
]);

const schematicNodeActions: RadialMenuItem[] = sorted([
  action({
    id: 'ai_schematic_review',
    label: 'AI ERC',
    description: 'Ask AI to review this symbol, nets, and schematic risks.',
    icon: Sparkles,
    slot: 0,
    group: 'inspect',
    hint: 'N',
  }),
  action({
    id: 'rotate',
    label: 'Rotate',
    description: 'Rotate the schematic symbol.',
    icon: RotateCw,
    slot: 1,
    group: 'transform',
    hint: 'NE',
  }),
  action({
    id: 'add_wire',
    label: 'Wire',
    description: 'Start wiring from this symbol or pin.',
    icon: ArrowRight,
    slot: 2,
    group: 'connect',
    hint: 'E',
  }),
  action({
    id: 'view_datasheet',
    label: 'Datasheet',
    description: 'Open reference material for this component.',
    icon: FileText,
    slot: 3,
    group: 'inspect',
    hint: 'SE',
  }),
  action({
    id: 'run_erc',
    label: 'ERC',
    description: 'Run electrical rule checks for the schematic.',
    icon: ShieldCheck,
    slot: 4,
    group: 'run',
    hint: 'S',
  }),
  action({
    id: 'delete',
    label: 'Delete',
    description: 'Remove this symbol from the schematic.',
    icon: Trash2,
    slot: 5,
    group: 'delete',
    hint: 'SW',
    destructive: true,
  }),
  action({
    id: 'edit_properties',
    label: 'Properties',
    description: 'Edit component values, pins, and metadata.',
    icon: Settings2,
    slot: 6,
    group: 'edit',
    hint: 'W',
  }),
  action({
    id: 'mirror',
    label: 'Mirror',
    description: 'Mirror the schematic symbol.',
    icon: FlipHorizontal2,
    slot: 7,
    group: 'reuse',
    hint: 'NW',
  }),
]);

const schematicCanvasActions: RadialMenuItem[] = sorted([
  action({
    id: 'add_component',
    label: 'Add Part',
    description: 'Place a new schematic component.',
    icon: Plus,
    slot: 0,
    group: 'create',
    hint: 'N',
  }),
  action({
    id: 'add_power',
    label: 'Add Power',
    description: 'Place a VCC power symbol at the current schematic work area.',
    icon: Zap,
    slot: 1,
    group: 'create',
    hint: 'NE',
  }),
  action({
    id: 'add_wire',
    label: 'Wire',
    description: 'Start a new schematic wire.',
    icon: ArrowRight,
    slot: 2,
    group: 'connect',
    hint: 'E',
  }),
  action({
    id: 'ai_schematic_review',
    label: 'AI ERC',
    description: 'Ask AI to review schematic structure, nets, and ERC risks.',
    icon: Sparkles,
    slot: 3,
    group: 'inspect',
    hint: 'SE',
  }),
  action({
    id: 'run_erc',
    label: 'ERC',
    description: 'Run electrical rule checks.',
    icon: ShieldCheck,
    slot: 4,
    group: 'run',
    hint: 'S',
  }),
  action({
    id: 'fit_view',
    label: 'Fit',
    description: 'Zoom the schematic canvas to fit the current design.',
    icon: Maximize,
    slot: 5,
    group: 'inspect',
    hint: 'SW',
  }),
  action({
    id: 'select_all',
    label: 'Select All',
    description: 'Select every schematic item.',
    icon: Grid3X3,
    slot: 6,
    group: 'edit',
    hint: 'W',
  }),
  action({
    id: 'paste',
    label: 'Paste',
    description: 'Paste copied schematic content.',
    icon: ClipboardPaste,
    slot: 7,
    group: 'reuse',
    hint: 'NW',
  }),
]);

const schematicLinearActions: RadialMenuItem[] = sorted([
  ...schematicCanvasActions,
  action({
    id: 'toggle_grid',
    label: 'Toggle Grid',
    description: 'Show or hide the schematic grid overlay.',
    icon: Grid3X3,
    slot: 1,
    group: 'transform',
    hint: 'G',
  }),
  action({
    id: 'replace_component',
    label: 'Replace Part',
    description: 'Open the replacement flow for the selected schematic component.',
    icon: RefreshCw,
    slot: 6,
    group: 'edit',
    hint: 'R',
  }),
  action({
    id: 'add_decoupling',
    label: 'Decoupling',
    description: 'Add common decoupling capacitors to the selected schematic component.',
    icon: Zap,
    slot: 7,
    group: 'reuse',
    hint: 'D',
  }),
]);

const pcbNodeActions: RadialMenuItem[] = sorted([
  action({
    id: 'ai_pcb_review',
    label: 'AI DFM',
    description: 'Ask AI to review this footprint, routing, and manufacturability risks.',
    icon: Sparkles,
    slot: 0,
    group: 'inspect',
    hint: 'N',
  }),
  action({
    id: 'rotate',
    label: 'Rotate',
    description: 'Rotate the footprint or selected object.',
    icon: RotateCw,
    slot: 1,
    group: 'transform',
    hint: 'NE',
  }),
  action({
    id: 'route_trace',
    label: 'Route',
    description: 'Start routing from this pad or trace.',
    icon: CircuitBoard,
    slot: 2,
    group: 'connect',
    hint: 'E',
  }),
  action({
    id: 'measure',
    label: 'Measure',
    description: 'Measure clearance, distance, or geometry.',
    icon: Ruler,
    slot: 3,
    group: 'inspect',
    hint: 'SE',
  }),
  action({
    id: 'run_drc',
    label: 'DRC',
    description: 'Run PCB design rule checks.',
    icon: ShieldCheck,
    slot: 4,
    group: 'run',
    hint: 'S',
  }),
  action({
    id: 'delete',
    label: 'Delete',
    description: 'Remove the selected PCB object.',
    icon: Trash2,
    slot: 5,
    group: 'delete',
    hint: 'SW',
    destructive: true,
  }),
  action({
    id: 'edit_pad',
    label: 'Edit Pad',
    description: 'Edit pad or footprint settings.',
    icon: Settings2,
    slot: 6,
    group: 'edit',
    hint: 'W',
  }),
  action({
    id: 'flip_side',
    label: 'Flip',
    description: 'Move the footprint to the opposite board side.',
    icon: FlipHorizontal2,
    slot: 7,
    group: 'reuse',
    hint: 'NW',
  }),
]);

const pcbCanvasActions: RadialMenuItem[] = sorted([
  action({
    id: 'add_via',
    label: 'Add Via',
    description: 'Place a via at the pointer.',
    icon: Zap,
    slot: 0,
    group: 'create',
    hint: 'N',
  }),
  action({
    id: 'ai_pcb_review',
    label: 'AI DFM',
    description: 'Ask AI to review board routing, placement, DRC, and manufacturability risks.',
    icon: Sparkles,
    slot: 1,
    group: 'inspect',
    hint: 'NE',
  }),
  action({
    id: 'route_trace',
    label: 'Route',
    description: 'Start trace routing.',
    icon: CircuitBoard,
    slot: 2,
    group: 'connect',
    hint: 'E',
  }),
  action({
    id: 'measure',
    label: 'Measure',
    description: 'Measure board geometry.',
    icon: Ruler,
    slot: 3,
    group: 'inspect',
    hint: 'SE',
  }),
  action({
    id: 'run_drc',
    label: 'DRC',
    description: 'Run PCB design rule checks.',
    icon: ShieldCheck,
    slot: 4,
    group: 'run',
    hint: 'S',
  }),
  action({
    id: 'add_keepout',
    label: 'Keepout',
    description: 'Start drawing a PCB keepout zone.',
    icon: ShieldAlert,
    slot: 5,
    group: 'delete',
    hint: 'SW',
  }),
  action({
    id: 'select_all',
    label: 'Select All',
    description: 'Select every PCB object.',
    icon: Grid3X3,
    slot: 6,
    group: 'edit',
    hint: 'W',
  }),
  action({
    id: 'paste',
    label: 'Paste',
    description: 'Paste copied PCB objects.',
    icon: ClipboardPaste,
    slot: 7,
    group: 'reuse',
    hint: 'NW',
  }),
]);

const pcbCanvasLinearActions: RadialMenuItem[] = sorted([
  ...pcbCanvasActions,
  action({
    id: 'add_pour',
    label: 'Copper Pour',
    description: 'Start drawing a copper pour zone.',
    icon: Pentagon,
    slot: 0,
    group: 'create',
    hint: 'P',
  }),
  action({
    id: 'add_comment',
    label: 'Comment',
    description: 'Pin a PCB review comment on the board.',
    icon: MessageSquarePlus,
    slot: 6,
    group: 'edit',
    hint: 'C',
  }),
  action({
    id: 'fit_view',
    label: 'Fit',
    description: 'Reset PCB zoom and pan to the board origin.',
    icon: Maximize,
    slot: 3,
    group: 'inspect',
    hint: 'F',
  }),
  action({
    id: 'copy',
    label: 'Copy',
    description: 'Copy selected PCB objects.',
    icon: Copy,
    slot: 7,
    group: 'reuse',
    hint: 'Ctrl+C',
  }),
]);

const pcbNodeLinearActions: RadialMenuItem[] = sorted([
  ...pcbNodeActions,
  action({
    id: 'fit_view',
    label: 'Fit',
    description: 'Reset PCB zoom and pan to the board origin.',
    icon: Maximize,
    slot: 3,
    group: 'inspect',
    hint: 'F',
  }),
  action({
    id: 'select_all',
    label: 'Select All',
    description: 'Select every placed PCB footprint.',
    icon: Grid3X3,
    slot: 6,
    group: 'edit',
    hint: 'W',
  }),
  action({
    id: 'copy',
    label: 'Copy',
    description: 'Copy selected PCB objects.',
    icon: Copy,
    slot: 7,
    group: 'reuse',
    hint: 'Ctrl+C',
  }),
  action({
    id: 'paste',
    label: 'Paste',
    description: 'Paste copied PCB objects.',
    icon: ClipboardPaste,
    slot: 7,
    group: 'reuse',
    hint: 'Ctrl+V',
  }),
]);

const breadboardNodeActions: RadialMenuItem[] = sorted([
  action({
    id: 'ai_breadboard_wiring',
    label: 'AI Wiring',
    description: 'Ask AI to review this breadboard part, jumpers, rails, and wiring risks.',
    icon: Sparkles,
    slot: 0,
    group: 'inspect',
    hint: 'N',
  }),
  action({
    id: 'move',
    label: 'Move',
    description: 'Move the breadboard part.',
    icon: Move,
    slot: 1,
    group: 'transform',
    hint: 'NE',
  }),
  action({
    id: 'add_wire',
    label: 'Jumper',
    description: 'Start a jumper wire from this part.',
    icon: ArrowRight,
    slot: 2,
    group: 'connect',
    hint: 'E',
  }),
  action({
    id: 'view_datasheet',
    label: 'Pinout',
    description: 'Inspect the part pinout or datasheet.',
    icon: FileText,
    slot: 3,
    group: 'inspect',
    hint: 'SE',
  }),
  action({
    id: 'validate_wiring',
    label: 'Audit',
    description: 'Validate breadboard wiring and rails.',
    icon: ShieldCheck,
    slot: 4,
    group: 'run',
    hint: 'S',
  }),
  action({
    id: 'delete',
    label: 'Delete',
    description: 'Remove this breadboard part.',
    icon: Trash2,
    slot: 5,
    group: 'delete',
    hint: 'SW',
    destructive: true,
  }),
  action({
    id: 'edit_properties',
    label: 'Properties',
    description: 'Edit part metadata and breadboard settings.',
    icon: Settings2,
    slot: 6,
    group: 'edit',
    hint: 'W',
  }),
  action({
    id: 'rotate',
    label: 'Rotate',
    description: 'Rotate the part orientation.',
    icon: RotateCw,
    slot: 7,
    group: 'reuse',
    hint: 'NW',
  }),
]);

const breadboardCanvasActions: RadialMenuItem[] = sorted([
  action({
    id: 'add_component',
    label: 'Add Part',
    description: 'Place a breadboard component.',
    icon: Plus,
    slot: 0,
    group: 'create',
    hint: 'N',
  }),
  action({
    id: 'ai_breadboard_wiring',
    label: 'AI Wiring',
    description: 'Ask AI to review the breadboard layout, jumpers, rails, and next safe wiring move.',
    icon: Sparkles,
    slot: 1,
    group: 'inspect',
    hint: 'NE',
  }),
  action({
    id: 'add_wire',
    label: 'Jumper',
    description: 'Start a jumper wire.',
    icon: ArrowRight,
    slot: 2,
    group: 'connect',
    hint: 'E',
  }),
  action({
    id: 'show_rails',
    label: 'Rails',
    description: 'Inspect power rail continuity.',
    icon: Activity,
    slot: 3,
    group: 'inspect',
    hint: 'SE',
  }),
  action({
    id: 'validate_wiring',
    label: 'Audit',
    description: 'Validate breadboard wiring.',
    icon: ShieldCheck,
    slot: 4,
    group: 'run',
    hint: 'S',
  }),
  action({
    id: 'delete',
    label: 'Delete',
    description: 'Switch to delete mode for breadboard parts and jumpers.',
    icon: Trash2,
    slot: 5,
    group: 'delete',
    hint: 'SW',
    destructive: true,
  }),
  action({
    id: 'select_all',
    label: 'Select All',
    description: 'Select every breadboard part.',
    icon: Grid3X3,
    slot: 6,
    group: 'edit',
    hint: 'W',
  }),
  action({
    id: 'starter_circuit',
    label: 'Starter',
    description: 'Open starter circuit suggestions.',
    icon: Sparkles,
    slot: 7,
    group: 'reuse',
    hint: 'NW',
  }),
]);

const bomRowActions: RadialMenuItem[] = sorted([
  action({
    id: 'add_to_inventory',
    label: 'Stock Bin',
    description: 'Add this part to personal inventory.',
    icon: Package,
    slot: 0,
    group: 'create',
    hint: 'N',
  }),
  action({
    id: 'ai_part_tradeoffs',
    label: 'AI Tradeoffs',
    description: 'Ask AI to compare cost, availability, lifecycle, and risk.',
    icon: Sparkles,
    slot: 1,
    group: 'transform',
    hint: 'NE',
  }),
  action({
    id: 'find_alternates',
    label: 'Alternates',
    description: 'Find compatible substitutes.',
    icon: Search,
    slot: 2,
    group: 'connect',
    hint: 'E',
  }),
  action({
    id: 'view_datasheet',
    label: 'Datasheet',
    description: 'Open the part datasheet.',
    icon: FileText,
    slot: 3,
    group: 'inspect',
    hint: 'SE',
  }),
  action({
    id: 'check_supply_risk',
    label: 'Risk',
    description: 'Check stock, lifecycle, and sourcing risk.',
    icon: Gauge,
    slot: 4,
    group: 'run',
    hint: 'S',
  }),
  action({
    id: 'remove',
    label: 'Remove',
    description: 'Remove this line from the BOM.',
    icon: Trash2,
    slot: 5,
    group: 'delete',
    hint: 'SW',
    destructive: true,
  }),
  action({
    id: 'edit_quantity',
    label: 'Quantity',
    description: 'Edit quantity and sourcing fields.',
    icon: Edit,
    slot: 6,
    group: 'edit',
    hint: 'W',
  }),
  action({
    id: 'copy_bom_row',
    label: 'Copy',
    description: 'Copy this BOM row summary.',
    icon: Copy,
    slot: 7,
    group: 'reuse',
    hint: 'NW',
  }),
]);

const bomCanvasActions: RadialMenuItem[] = sorted([
  action({
    id: 'add_bom_item',
    label: 'Add Item',
    description: 'Open the BOM item form for a new part.',
    icon: Plus,
    slot: 0,
    group: 'create',
    hint: 'N',
  }),
  action({
    id: 'ai_bom_plan',
    label: 'AI Plan',
    description: 'Ask AI to review BOM readiness, sourcing risk, gaps, and next procurement moves.',
    icon: Sparkles,
    slot: 1,
    group: 'inspect',
    hint: 'NE',
  }),
  action({
    id: 'open_bom_alternates',
    label: 'Alternates',
    description: 'Open alternate-part discovery for the BOM.',
    icon: Search,
    slot: 2,
    group: 'connect',
    hint: 'E',
  }),
  action({
    id: 'open_bom_templates',
    label: 'Templates',
    description: 'Open reusable BOM templates.',
    icon: FileJson,
    slot: 3,
    group: 'reuse',
    hint: 'SE',
  }),
  action({
    id: 'quote_bom',
    label: 'Quote',
    description: 'Quote the entire BOM across supplier data.',
    icon: Gauge,
    slot: 4,
    group: 'run',
    hint: 'S',
  }),
  action({
    id: 'open_supply_chain',
    label: 'Alerts',
    description: 'Open supply-chain alerts and lifecycle risk signals.',
    icon: ShieldAlert,
    slot: 5,
    group: 'inspect',
    hint: 'SW',
  }),
  action({
    id: 'open_bom_settings',
    label: 'Settings',
    description: 'Open BOM settings, preferred suppliers, and optimization goals.',
    icon: Settings2,
    slot: 6,
    group: 'edit',
    hint: 'W',
  }),
  action({
    id: 'export_bom_csv',
    label: 'Export',
    description: 'Export the current filtered BOM as CSV.',
    icon: Download,
    slot: 7,
    group: 'reuse',
    hint: 'NW',
  }),
]);

const validationActions: RadialMenuItem[] = sorted([
  action({
    id: 'create_task',
    label: 'Task',
    description: 'Create a tracked task from this issue.',
    icon: Plus,
    slot: 0,
    group: 'create',
    hint: 'N',
  }),
  action({
    id: 'ai_issue_fix',
    label: 'AI Fix',
    description: 'Ask AI for a practical fix path for this issue.',
    icon: Sparkles,
    slot: 1,
    group: 'inspect',
    hint: 'NE',
  }),
  action({
    id: 'jump_to_source',
    label: 'Jump',
    description: 'Open the related canvas item.',
    icon: Crosshair,
    slot: 2,
    group: 'connect',
    hint: 'E',
  }),
  action({
    id: 'explain_issue',
    label: 'AI Explain',
    description: 'Explain this validation result.',
    icon: Microscope,
    slot: 3,
    group: 'inspect',
    hint: 'SE',
  }),
  action({
    id: 'rerun_validation',
    label: 'Re-run',
    description: 'Run validation again.',
    icon: ShieldCheck,
    slot: 4,
    group: 'run',
    hint: 'S',
  }),
  action({
    id: 'suppress_issue',
    label: 'Suppress',
    description: 'Suppress with a reason.',
    icon: Trash2,
    slot: 5,
    group: 'delete',
    hint: 'SW',
    destructive: true,
  }),
  action({
    id: 'open_validation_summary',
    label: 'Summary',
    description: 'Open the validation safety summary.',
    icon: FileText,
    slot: 6,
    group: 'inspect',
    hint: 'W',
  }),
  action({
    id: 'copy_issue',
    label: 'Copy',
    description: 'Copy the issue details.',
    icon: Copy,
    slot: 7,
    group: 'reuse',
    hint: 'NW',
  }),
]);

const simulationActions: RadialMenuItem[] = sorted([
  action({
    id: 'add_probe',
    label: 'Probe',
    description: 'Add a voltage or current probe.',
    icon: Plus,
    slot: 0,
    group: 'create',
    hint: 'N',
  }),
  action({
    id: 'ai_simulation_explain',
    label: 'AI Explain',
    description: 'Ask AI to explain probe intent, expected behavior, and next simulation checks.',
    icon: Sparkles,
    slot: 1,
    group: 'inspect',
    hint: 'NE',
  }),
  action({
    id: 'run_simulation',
    label: 'Run',
    description: 'Run the current simulation.',
    icon: Play,
    slot: 2,
    group: 'connect',
    hint: 'E',
  }),
  action({
    id: 'compare_waveform',
    label: 'Compare',
    description: 'Compare waveform results.',
    icon: Activity,
    slot: 3,
    group: 'inspect',
    hint: 'SE',
  }),
  action({
    id: 'sweep_simulation',
    label: 'Sweep',
    description: 'Run a parameter sweep.',
    icon: BarChart3,
    slot: 4,
    group: 'run',
    hint: 'S',
  }),
  action({
    id: 'remove_probe',
    label: 'Remove',
    description: 'Remove the selected simulation probe.',
    icon: Trash2,
    slot: 5,
    group: 'delete',
    hint: 'SW',
    destructive: true,
  }),
  action({
    id: 'simulation_settings',
    label: 'Settings',
    description: 'Edit simulation setup.',
    icon: SlidersHorizontal,
    slot: 6,
    group: 'edit',
    hint: 'W',
  }),
  action({
    id: 'export_waveform',
    label: 'Export',
    description: 'Export waveform data.',
    icon: Download,
    slot: 7,
    group: 'reuse',
    hint: 'NW',
  }),
]);

const starterCircuitActions: RadialMenuItem[] = sorted([
  action({
    id: 'ai_starter_learn',
    label: 'AI Learn',
    description: 'Ask AI to explain this starter circuit, wiring idea, and first safe build step.',
    icon: Sparkles,
    slot: 0,
    group: 'inspect',
    hint: 'N',
  }),
  action({
    id: 'starter_show_difficulty',
    label: 'Same Level',
    description: 'Filter the gallery to starter circuits with this difficulty level.',
    icon: Gauge,
    slot: 1,
    group: 'transform',
    hint: 'NE',
  }),
  action({
    id: 'open_starter_circuit',
    label: 'Open',
    description: 'Open this starter circuit in the Arduino workbench.',
    icon: CircuitBoard,
    slot: 2,
    group: 'connect',
    hint: 'E',
  }),
  action({
    id: 'starter_show_category',
    label: 'Similar',
    description: 'Filter the gallery to starter circuits in this category.',
    icon: Search,
    slot: 3,
    group: 'inspect',
    hint: 'SE',
  }),
  action({
    id: 'starter_toggle_details',
    label: 'Details',
    description: 'Expand or collapse this starter circuit card.',
    icon: Maximize,
    slot: 4,
    group: 'run',
    hint: 'S',
  }),
  action({
    id: 'starter_reset_filters',
    label: 'Reset',
    description: 'Clear starter circuit search and filters.',
    icon: RefreshCw,
    slot: 5,
    group: 'edit',
    hint: 'SW',
  }),
  action({
    id: 'copy_starter_parts',
    label: 'Copy Parts',
    description: 'Copy the component list for this starter circuit.',
    icon: Package,
    slot: 6,
    group: 'reuse',
    hint: 'W',
  }),
  action({
    id: 'copy_starter_code',
    label: 'Copy Code',
    description: 'Copy this starter circuit sketch.',
    icon: Copy,
    slot: 7,
    group: 'reuse',
    hint: 'NW',
  }),
]);

const starterCircuitCanvasActions: RadialMenuItem[] = sorted([
  action({
    id: 'ai_starter_learn',
    label: 'AI Pick',
    description: 'Ask AI to explain the first visible starter circuit and safest first build step.',
    icon: Sparkles,
    slot: 0,
    group: 'inspect',
    hint: 'N',
  }),
  action({
    id: 'starter_filter_beginner',
    label: 'Beginner',
    description: 'Filter the gallery to beginner-friendly circuits.',
    icon: Gauge,
    slot: 1,
    group: 'transform',
    hint: 'NE',
  }),
  action({
    id: 'open_starter_circuit',
    label: 'Open',
    description: 'Open the first visible starter circuit in the Arduino workbench.',
    icon: CircuitBoard,
    slot: 2,
    group: 'connect',
    hint: 'E',
  }),
  action({
    id: 'starter_filter_sensors',
    label: 'Sensors',
    description: 'Filter starter circuits to sensor builds.',
    icon: Search,
    slot: 3,
    group: 'inspect',
    hint: 'SE',
  }),
  action({
    id: 'starter_filter_motors',
    label: 'Motors',
    description: 'Filter starter circuits to motor builds.',
    icon: Play,
    slot: 4,
    group: 'run',
    hint: 'S',
  }),
  action({
    id: 'starter_reset_filters',
    label: 'Reset',
    description: 'Clear starter circuit search and filters.',
    icon: RefreshCw,
    slot: 5,
    group: 'edit',
    hint: 'SW',
  }),
  action({
    id: 'starter_filter_displays',
    label: 'Displays',
    description: 'Filter starter circuits to display builds.',
    icon: Monitor,
    slot: 6,
    group: 'edit',
    hint: 'W',
  }),
  action({
    id: 'copy_starter_code',
    label: 'Copy Code',
    description: 'Copy code from the first visible starter circuit.',
    icon: Copy,
    slot: 7,
    group: 'reuse',
    hint: 'NW',
  }),
]);

const model3dActions: RadialMenuItem[] = sorted([
  action({
    id: 'ai_3d_fit_inspection',
    label: 'AI Fit',
    description: 'Ask AI to inspect 3D fit, route provenance, clearances, and physical risks.',
    icon: Sparkles,
    slot: 0,
    group: 'inspect',
    hint: 'N',
  }),
  action({
    id: 'isolate_model',
    label: 'Isolate',
    description: 'Isolate the selected model part.',
    icon: Box,
    slot: 1,
    group: 'transform',
    hint: 'NE',
  }),
  action({
    id: 'cross_probe',
    label: 'Cross-probe',
    description: 'Highlight the related schematic or PCB item.',
    icon: Crosshair,
    slot: 2,
    group: 'connect',
    hint: 'E',
  }),
  action({
    id: 'measure',
    label: 'Measure',
    description: 'Measure physical dimensions.',
    icon: Ruler,
    slot: 3,
    group: 'inspect',
    hint: 'SE',
  }),
  action({
    id: 'fit_check',
    label: 'Fit Check',
    description: 'Run mechanical fit checks.',
    icon: ShieldCheck,
    slot: 4,
    group: 'run',
    hint: 'S',
  }),
  action({
    id: 'clear_3d_scene',
    label: 'Clear',
    description: 'Clear the current 3D scene.',
    icon: Trash2,
    slot: 5,
    group: 'delete',
    hint: 'SW',
    destructive: true,
  }),
  action({
    id: 'model_properties',
    label: 'Properties',
    description: 'Inspect model metadata.',
    icon: Settings2,
    slot: 6,
    group: 'edit',
    hint: 'W',
  }),
  action({
    id: 'capture_view',
    label: 'Capture',
    description: 'Capture the current 3D view.',
    icon: Download,
    slot: 7,
    group: 'reuse',
    hint: 'NW',
  }),
]);

const serialActions: RadialMenuItem[] = sorted([
  action({
    id: 'ai_serial_decode',
    label: 'AI Decode',
    description: 'Ask AI to decode recent serial output and likely hardware or firmware causes.',
    icon: Sparkles,
    slot: 1,
    group: 'inspect',
    hint: 'NE',
  }),
  action({
    id: 'mark_event',
    label: 'Mark',
    description: 'Mark this point in the serial stream.',
    icon: Plus,
    slot: 0,
    group: 'create',
    hint: 'N',
  }),
  action({
    id: 'resume_serial',
    label: 'Pause/Run',
    description: 'Pause or resume the serial stream.',
    icon: Play,
    slot: 2,
    group: 'connect',
    hint: 'E',
  }),
  action({
    id: 'analyze_log',
    label: 'Analyze',
    description: 'Analyze selected serial output.',
    icon: Microscope,
    slot: 3,
    group: 'inspect',
    hint: 'SE',
  }),
  action({
    id: 'decode_serial',
    label: 'Decode',
    description: 'Decode structured serial data.',
    icon: FileCode,
    slot: 4,
    group: 'run',
    hint: 'S',
  }),
  action({
    id: 'clear_serial',
    label: 'Clear',
    description: 'Clear serial output.',
    icon: Trash2,
    slot: 5,
    group: 'delete',
    hint: 'SW',
    destructive: true,
  }),
  action({
    id: 'filter_serial',
    label: 'Filter',
    description: 'Edit stream filters.',
    icon: SlidersHorizontal,
    slot: 6,
    group: 'edit',
    hint: 'W',
  }),
  action({
    id: 'export_log',
    label: 'Export',
    description: 'Export the serial log.',
    icon: Download,
    slot: 7,
    group: 'reuse',
    hint: 'NW',
  }),
]);

const exportsActions: RadialMenuItem[] = sorted([
  action({
    id: 'create_export',
    label: 'Export',
    description: 'Create a new project export.',
    icon: Download,
    slot: 0,
    group: 'create',
    hint: 'N',
  }),
  action({
    id: 'ai_export_plan',
    label: 'AI Plan',
    description: 'Ask AI to review export readiness, release risk, and fab handoff gaps.',
    icon: Sparkles,
    slot: 1,
    group: 'inspect',
    hint: 'NE',
  }),
  action({
    id: 'reveal_export_format',
    label: 'Reveal',
    description: 'Center this export format without launching it.',
    icon: Crosshair,
    slot: 2,
    group: 'connect',
    hint: 'E',
  }),
  action({
    id: 'open_import_design',
    label: 'Import',
    description: 'Open the design import chooser.',
    icon: ClipboardPaste,
    slot: 3,
    group: 'reuse',
    hint: 'SE',
  }),
  action({
    id: 'run_export_precheck',
    label: 'Precheck',
    description: 'Run export readiness checks.',
    icon: ShieldCheck,
    slot: 4,
    group: 'run',
    hint: 'S',
  }),
  action({
    id: 'open_import_history',
    label: 'History',
    description: 'Open import history for restore and review.',
    icon: History,
    slot: 5,
    group: 'inspect',
    hint: 'SW',
  }),
  action({
    id: 'export_settings',
    label: 'Settings',
    description: 'Edit export profile settings.',
    icon: Settings2,
    slot: 6,
    group: 'edit',
    hint: 'W',
  }),
  action({
    id: 'copy_export_summary',
    label: 'Copy',
    description: 'Copy an export summary.',
    icon: Copy,
    slot: 7,
    group: 'reuse',
    hint: 'NW',
  }),
]);

const firmwareActions: RadialMenuItem[] = sorted([
  action({
    id: 'add_firmware_snippet',
    label: 'Snippet',
    description: 'Insert a firmware snippet.',
    icon: Plus,
    slot: 0,
    group: 'create',
    hint: 'N',
  }),
  action({
    id: 'ai_firmware_review',
    label: 'AI Review',
    description: 'Ask AI to review firmware readiness, pin safety, and next bench checks.',
    icon: Sparkles,
    slot: 1,
    group: 'inspect',
    hint: 'NE',
  }),
  action({
    id: 'format_firmware',
    label: 'Format',
    description: 'Format or normalize the active firmware source.',
    icon: FileCode,
    slot: 2,
    group: 'edit',
    hint: 'E',
  }),
  action({
    id: 'open_firmware_review',
    label: 'Review',
    description: 'Open the strongest available firmware review surface.',
    icon: ShieldCheck,
    slot: 3,
    group: 'inspect',
    hint: 'SE',
  }),
  action({
    id: 'compile_firmware',
    label: 'Compile',
    description: 'Compile the sketch or firmware file.',
    icon: Play,
    slot: 4,
    group: 'run',
    hint: 'S',
  }),
  action({
    id: 'open_firmware_console',
    label: 'Console',
    description: 'Open firmware status, console, or error output.',
    icon: FileText,
    slot: 5,
    group: 'inspect',
    hint: 'SW',
  }),
  action({
    id: 'firmware_settings',
    label: 'Settings',
    description: 'Edit board and library settings.',
    icon: Settings2,
    slot: 6,
    group: 'edit',
    hint: 'W',
  }),
  action({
    id: 'export_firmware',
    label: 'Export',
    description: 'Export firmware artifacts.',
    icon: Download,
    slot: 7,
    group: 'reuse',
    hint: 'NW',
  }),
]);

const inventoryActions: RadialMenuItem[] = sorted([
  action({
    id: 'add_inventory_item',
    label: 'Add Part',
    description: 'Add a physical part to inventory.',
    icon: Plus,
    slot: 0,
    group: 'create',
    hint: 'N',
  }),
  action({
    id: 'ai_inventory_plan',
    label: 'AI Plan',
    description: 'Ask AI for inventory readiness, stock risk, and bin-count next steps.',
    icon: Sparkles,
    slot: 1,
    group: 'inspect',
    hint: 'NE',
  }),
  action({
    id: 'find_alternates',
    label: 'Alternates',
    description: 'Find substitutes for this part.',
    icon: Search,
    slot: 2,
    group: 'connect',
    hint: 'E',
  }),
  action({
    id: 'inspect_part',
    label: 'Inspect',
    description: 'Inspect inventory metadata.',
    icon: Microscope,
    slot: 3,
    group: 'inspect',
    hint: 'SE',
  }),
  action({
    id: 'stock_audit',
    label: 'Audit',
    description: 'Audit stock and bin counts.',
    icon: ShieldCheck,
    slot: 4,
    group: 'run',
    hint: 'S',
  }),
  action({
    id: 'remove_inventory_item',
    label: 'Remove',
    description: 'Remove this inventory item.',
    icon: Trash2,
    slot: 5,
    group: 'delete',
    hint: 'SW',
    destructive: true,
  }),
  action({
    id: 'edit_inventory_item',
    label: 'Edit',
    description: 'Edit inventory item details.',
    icon: Edit,
    slot: 6,
    group: 'edit',
    hint: 'W',
  }),
  action({
    id: 'print_inventory_label',
    label: 'Labels',
    description: 'Open QR label printing for inventory bins.',
    icon: Printer,
    slot: 7,
    group: 'reuse',
    hint: 'NW',
  }),
]);

const RADIAL_COVERAGE_CONTEXTS: Array<Pick<MenuContext, 'view' | 'target'>> = [
  { view: 'architecture', target: 'canvas' },
  { view: 'architecture', target: 'node' },
  { view: 'schematic', target: 'canvas' },
  { view: 'schematic', target: 'node' },
  { view: 'pcb', target: 'canvas' },
  { view: 'pcb', target: 'node' },
  { view: 'pcb', target: 'pad' },
  { view: 'pcb', target: 'via' },
  { view: 'pcb', target: 'trace' },
  { view: 'breadboard', target: 'canvas' },
  { view: 'breadboard', target: 'node' },
  { view: 'breadboard', target: 'wire' },
  { view: 'bom', target: 'bom_row' },
  { view: 'bom', target: 'canvas' },
  { view: 'validation', target: 'issue' },
  { view: 'simulation', target: 'probe' },
  { view: 'starter_circuits', target: 'starter_circuit' },
  { view: 'starter_circuits', target: 'canvas' },
  { view: 'model_3d', target: 'model' },
  { view: 'serial', target: 'log_line' },
  { view: 'exports', target: 'file' },
  { view: 'firmware', target: 'file' },
  { view: 'inventory', target: 'part' },
];

function getCoverageLevel(commandCount: number, usedSlotCount: number): RadialCoverageLevel {
  if (commandCount === 0) {
    return 'empty';
  }
  if (usedSlotCount <= 3) {
    return 'thin';
  }
  return usedSlotCount >= RADIAL_SLOT_COUNT ? 'full' : 'ready';
}

function getRadialCoverageEntry(context: Pick<MenuContext, 'view' | 'target'>): RadialCoverageEntry {
  const radialContext: MenuContext = { view: context.view, target: context.target };
  const commands = getActionsForContext(radialContext);
  const linearCommands = getLinearActionsForContext(radialContext);
  const usedSlots = new Set(commands.map((command) => command.slot));
  const emptySlotDirections = Object.entries(radialSlotMeta)
    .filter(([slot]) => !usedSlots.has(Number(slot) as RadialSlot))
    .map(([, meta]) => meta.direction);

  return {
    key: `${context.view}-${context.target}`,
    context: { view: context.view, target: context.target },
    viewLabel: getViewSummary(radialContext),
    targetLabel: getTargetSummary(radialContext),
    commandCount: commands.length,
    linearCommandCount: linearCommands.length,
    aiCommandCount: commands.filter(isRadialAiCommand).length,
    destructiveCount: commands.filter((command) => command.destructive).length,
    usedSlotCount: usedSlots.size,
    emptySlotCount: RADIAL_SLOT_COUNT - usedSlots.size,
    emptySlotDirections,
    coverageLevel: getCoverageLevel(commands.length, usedSlots.size),
    commandIds: commands.map((command) => command.id),
  };
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Returns the appropriate radial-menu items for the given context.
 * Menus are intentionally capped to eight stable compass slots for speed and
 * muscle-memory. More commands should go into subrings or the command palette.
 */
export function getActionsForContext(context: MenuContext): RadialMenuItem[] {
  switch (context.view) {
    case 'architecture':
      return context.target === 'node' ? architectureNodeActions : architectureCanvasActions;
    case 'schematic':
      return context.target === 'node' ? schematicNodeActions : schematicCanvasActions;
    case 'pcb':
      return context.target === 'node' ||
        context.target === 'pad' ||
        context.target === 'via' ||
        context.target === 'trace'
        ? pcbNodeActions
        : pcbCanvasActions;
    case 'breadboard':
      return context.target === 'node' || context.target === 'wire' ? breadboardNodeActions : breadboardCanvasActions;
    case 'bom':
      return context.target === 'bom_row' ? bomRowActions : bomCanvasActions;
    case 'validation':
      return validationActions;
    case 'simulation':
      return simulationActions;
    case 'starter_circuits':
      return context.target === 'starter_circuit' ? starterCircuitActions : starterCircuitCanvasActions;
    case 'model_3d':
      return model3dActions;
    case 'serial':
      return serialActions;
    case 'exports':
      return exportsActions;
    case 'firmware':
      return firmwareActions;
    case 'inventory':
      return inventoryActions;
  }
}

/**
 * Returns the fuller command set used by linear context-menu fallbacks. The
 * radial wheel remains capped by `getActionsForContext`; linear menus can
 * expose extra low-frequency commands without crowding the wheel.
 */
export function getLinearActionsForContext(context: MenuContext): RadialMenuItem[] {
  switch (context.view) {
    case 'architecture':
      return architectureLinearActions;
    case 'schematic':
      return schematicLinearActions;
    case 'pcb':
      return context.target === 'canvas' ? pcbCanvasLinearActions : pcbNodeLinearActions;
    default:
      return getActionsForContext(context);
  }
}

export function getActionById(context: MenuContext, itemId: string): RadialMenuItem | undefined {
  return (
    getActionsForContext(context).find((item) => item.id === itemId) ??
    getLinearActionsForContext(context).find((item) => item.id === itemId)
  );
}

/**
 * Returns the full list of context types that have radial-menu support.
 */
export function getSupportedContextTypes(): MenuContextType[] {
  return [
    'architecture',
    'schematic',
    'pcb',
    'breadboard',
    'bom',
    'validation',
    'simulation',
    'starter_circuits',
    'model_3d',
    'serial',
    'exports',
    'firmware',
    'inventory',
  ];
}

/**
 * Returns a compact audit map for the radial command layer. This is used by
 * the customizer to show where the wheel is complete, thin, or still empty.
 */
export function getRadialCoverageEntries(): RadialCoverageEntry[] {
  return RADIAL_COVERAGE_CONTEXTS.map(getRadialCoverageEntry);
}
