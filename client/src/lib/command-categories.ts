import {
  Pencil,
  Play,
  Factory,
  Users,
  Compass,
  Settings,
} from 'lucide-react';
import type { LucideIcon } from 'lucide-react';

/**
 * Command palette category types and categorization logic.
 * Groups commands into semantic categories for easier discovery.
 */

export type CommandCategory = 'design' | 'simulate' | 'manufacture' | 'collaborate' | 'navigation' | 'settings';

export interface CategoryMeta {
  label: string;
  icon: LucideIcon;
}

export const CATEGORY_LABELS: Record<CommandCategory, CategoryMeta> = {
  design: { label: 'Design', icon: Pencil },
  simulate: { label: 'Simulate', icon: Play },
  manufacture: { label: 'Manufacture', icon: Factory },
  collaborate: { label: 'Collaborate', icon: Users },
  navigation: { label: 'Navigation', icon: Compass },
  settings: { label: 'Settings', icon: Settings },
};

export const CATEGORY_ORDER: readonly CommandCategory[] = [
  'design',
  'simulate',
  'manufacture',
  'collaborate',
  'navigation',
  'settings',
] as const;

/**
 * Mapping from command ID prefixes/keywords to categories.
 * More specific matches (by ID) take priority over keyword fallback.
 */
const COMMAND_ID_CATEGORY_MAP: Record<string, CommandCategory> = {
  // Design tools
  'nav-architecture': 'design',
  'nav-schematic': 'design',
  'nav-pcb': 'design',
  'nav-breadboard': 'design',
  'nav-component-editor': 'design',
  'nav-circuit-code': 'design',
  'nav-design-patterns': 'design',
  'nav-generative-design': 'design',
  'nav-starter-circuits': 'design',
  'nav-calculators': 'design',

  // Simulation
  'nav-simulation': 'simulate',
  'nav-digital-twin': 'simulate',
  'action-run-drc': 'simulate',

  // Manufacturing / Output
  'nav-output': 'manufacture',
  'nav-ordering': 'manufacture',
  'nav-viewer-3d': 'manufacture',
  'action-export': 'manufacture',

  // Collaborate / Project
  'nav-community': 'collaborate',
  'nav-kanban': 'collaborate',
  'nav-knowledge': 'collaborate',
  'nav-comments': 'collaborate',
  'nav-lifecycle': 'collaborate',
  'nav-design-history': 'collaborate',

  // Inventory / Procurement
  'nav-procurement': 'manufacture',
  'nav-storage': 'manufacture',

  // Navigation / Panels
  'nav-dashboard': 'navigation',
  'nav-arduino': 'navigation',
  'nav-serial-monitor': 'navigation',
  'panel-sidebar': 'settings',
  'panel-chat': 'settings',
};

/**
 * Keyword-based fallback categorization when command ID is not in the map.
 * Checked against the command's label and keywords array.
 */
const KEYWORD_CATEGORY_MAP: Array<{ keywords: string[]; category: CommandCategory }> = [
  { keywords: ['schematic', 'circuit', 'pcb', 'board', 'component', 'trace', 'footprint', 'breadboard', 'wire', 'design', 'pattern', 'code', 'calculator', 'generative'], category: 'design' },
  { keywords: ['simulate', 'simulation', 'spice', 'analysis', 'drc', 'erc', 'validate', 'check', 'twin', 'telemetry', 'waveform'], category: 'simulate' },
  { keywords: ['export', 'gerber', 'kicad', 'manufacture', 'order', 'fabricate', 'bom', 'procurement', 'cost', 'inventory', 'stock', '3d', 'viewer', 'storage'], category: 'manufacture' },
  { keywords: ['community', 'share', 'kanban', 'task', 'knowledge', 'learn', 'comment', 'history', 'lifecycle', 'collaborate'], category: 'collaborate' },
  { keywords: ['sidebar', 'chat', 'panel', 'toggle', 'show', 'hide', 'settings', 'assistant'], category: 'settings' },
  { keywords: ['dashboard', 'navigate', 'arduino', 'serial', 'monitor'], category: 'navigation' },
];

export interface CommandItem {
  id: string;
  label: string;
  keywords?: string[];
}

/**
 * Determine the category for a single command based on its ID, label, and keywords.
 */
export function getCommandCategory(command: CommandItem): CommandCategory {
  // Direct ID match
  const directMatch = COMMAND_ID_CATEGORY_MAP[command.id];
  if (directMatch) {
    return directMatch;
  }

  // Keyword fallback: check label + keywords against keyword map
  const searchTokens = [
    command.label.toLowerCase(),
    ...(command.keywords ?? []).map((k) => k.toLowerCase()),
  ];

  for (const { keywords, category } of KEYWORD_CATEGORY_MAP) {
    for (const token of searchTokens) {
      if (keywords.some((kw) => token.includes(kw))) {
        return category;
      }
    }
  }

  // Default to navigation if no match
  return 'navigation';
}

export interface CategorizedCommand<T extends CommandItem> {
  category: CommandCategory;
  commands: T[];
}

/**
 * Group an array of commands into categories, sorted by CATEGORY_ORDER.
 * Commands within each category are sorted alphabetically by label.
 */
export function categorizeCommands<T extends CommandItem>(commands: T[]): CategorizedCommand<T>[] {
  const grouped = new Map<CommandCategory, T[]>();

  for (const command of commands) {
    const category = getCommandCategory(command);
    const existing = grouped.get(category);
    if (existing) {
      existing.push(command);
    } else {
      grouped.set(category, [command]);
    }
  }

  // Sort commands within each category alphabetically
  for (const [, cmds] of Array.from(grouped.entries())) {
    cmds.sort((a, b) => a.label.localeCompare(b.label));
  }

  // Return in CATEGORY_ORDER, omitting empty categories
  return CATEGORY_ORDER
    .filter((cat) => grouped.has(cat))
    .map((cat) => ({
      category: cat,
      commands: grouped.get(cat)!,
    }));
}
