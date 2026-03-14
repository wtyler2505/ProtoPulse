/**
 * Context-Aware Shortcuts Panel (BL-0236)
 *
 * Provides shortcut definitions organized by view context.
 * getShortcutsForView() returns global shortcuts plus view-specific ones
 * for the currently active view.
 */

import type { ViewMode } from '@/lib/project-context';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

/** A single keyboard shortcut entry for display in the overlay. */
export interface ShortcutEntry {
  /** The key combination as display text (e.g., "Ctrl+K", "Del"). */
  key: string;
  /** Human-readable description of what the shortcut does. */
  description: string;
  /** Grouping category (e.g., "Global", "Architecture", "Navigation"). */
  category: string;
}

// ---------------------------------------------------------------------------
// Shortcut Definitions
// ---------------------------------------------------------------------------

/** Global shortcuts that apply regardless of active view. */
export const GLOBAL_SHORTCUTS: ShortcutEntry[] = [
  { key: 'Ctrl+K', description: 'Command palette', category: 'Global' },
  { key: 'Ctrl+S', description: 'Save', category: 'Global' },
  { key: 'Ctrl+Z', description: 'Undo', category: 'Global' },
  { key: 'Ctrl+Shift+Z', description: 'Redo', category: 'Global' },
  { key: '?', description: 'Toggle shortcuts panel', category: 'Global' },
];

/** Architecture view shortcuts. */
export const ARCHITECTURE_SHORTCUTS: ShortcutEntry[] = [
  { key: 'N', description: 'New node', category: 'Architecture' },
  { key: 'E', description: 'New edge', category: 'Architecture' },
  { key: 'Del', description: 'Delete selected', category: 'Architecture' },
  { key: 'R', description: 'Rename selected', category: 'Architecture' },
  { key: 'Ctrl+A', description: 'Select all', category: 'Architecture' },
  { key: 'F', description: 'Fit view', category: 'Architecture' },
  { key: 'G', description: 'Toggle snap grid', category: 'Architecture' },
];

/** Schematic view shortcuts. */
export const SCHEMATIC_SHORTCUTS: ShortcutEntry[] = [
  { key: 'R', description: 'Rotate component', category: 'Schematic' },
  { key: 'M', description: 'Mirror component', category: 'Schematic' },
  { key: 'W', description: 'Wire tool', category: 'Schematic' },
  { key: 'Del', description: 'Delete selected', category: 'Schematic' },
  { key: 'V', description: 'Select tool', category: 'Schematic' },
  { key: 'H', description: 'Pan tool', category: 'Schematic' },
  { key: 'G', description: 'Toggle snap', category: 'Schematic' },
  { key: 'F', description: 'Fit view', category: 'Schematic' },
  { key: 'Esc', description: 'Cancel / deselect', category: 'Schematic' },
];

/** PCB layout view shortcuts. */
export const PCB_SHORTCUTS: ShortcutEntry[] = [
  { key: 'R', description: 'Rotate component', category: 'PCB Layout' },
  { key: 'F', description: 'Flip side / active layer', category: 'PCB Layout' },
  { key: 'T', description: 'Trace tool', category: 'PCB Layout' },
  { key: 'V', description: 'Via tool', category: 'PCB Layout' },
  { key: 'Del', description: 'Delete selected', category: 'PCB Layout' },
  { key: '1', description: 'Select tool', category: 'PCB Layout' },
  { key: '2', description: 'Trace tool', category: 'PCB Layout' },
  { key: '3', description: 'Delete tool', category: 'PCB Layout' },
  { key: 'Esc', description: 'Cancel / deselect', category: 'PCB Layout' },
];

/** BOM / Procurement view shortcuts. */
export const BOM_SHORTCUTS: ShortcutEntry[] = [
  { key: '+', description: 'Add item', category: 'BOM' },
  { key: 'Del', description: 'Remove selected', category: 'BOM' },
  { key: 'E', description: 'Edit selected', category: 'BOM' },
];

/** Component editor shortcuts. */
export const COMPONENT_EDITOR_SHORTCUTS: ShortcutEntry[] = [
  { key: 'S', description: 'Select tool', category: 'Component Editor' },
  { key: 'R', description: 'Rectangle tool', category: 'Component Editor' },
  { key: 'C', description: 'Circle tool', category: 'Component Editor' },
  { key: 'T', description: 'Text tool', category: 'Component Editor' },
  { key: 'L', description: 'Line tool', category: 'Component Editor' },
  { key: 'P', description: 'Pin tool', category: 'Component Editor' },
  { key: 'M', description: 'Measure tool', category: 'Component Editor' },
  { key: 'B', description: 'Path tool', category: 'Component Editor' },
  { key: 'Del', description: 'Delete selected', category: 'Component Editor' },
  { key: 'Ctrl+C', description: 'Copy', category: 'Component Editor' },
  { key: 'Ctrl+V', description: 'Paste', category: 'Component Editor' },
  { key: 'Space', description: 'Pan canvas', category: 'Component Editor' },
];

/** Breadboard view shortcuts. */
export const BREADBOARD_SHORTCUTS: ShortcutEntry[] = [
  { key: '1', description: 'Select tool', category: 'Breadboard' },
  { key: '2', description: 'Wire tool', category: 'Breadboard' },
  { key: '3', description: 'Delete tool', category: 'Breadboard' },
  { key: 'Del', description: 'Delete selected wire', category: 'Breadboard' },
  { key: 'Esc', description: 'Cancel / deselect', category: 'Breadboard' },
];

/** Simulation view shortcuts. */
export const SIMULATION_SHORTCUTS: ShortcutEntry[] = [
  { key: 'Ctrl+Enter', description: 'Run simulation', category: 'Simulation' },
  { key: 'Esc', description: 'Stop simulation', category: 'Simulation' },
];

/**
 * Map from ViewMode to the view-specific shortcut array.
 * Views not listed here will only show global shortcuts.
 */
const VIEW_SHORTCUT_MAP: Partial<Record<ViewMode, ShortcutEntry[]>> = {
  architecture: ARCHITECTURE_SHORTCUTS,
  schematic: SCHEMATIC_SHORTCUTS,
  pcb: PCB_SHORTCUTS,
  procurement: BOM_SHORTCUTS,
  component_editor: COMPONENT_EDITOR_SHORTCUTS,
  breadboard: BREADBOARD_SHORTCUTS,
  simulation: SIMULATION_SHORTCUTS,
};

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Returns all shortcuts relevant to the given view.
 * Always includes global shortcuts first, followed by view-specific ones.
 */
export function getShortcutsForView(view: ViewMode): ShortcutEntry[] {
  const viewShortcuts = VIEW_SHORTCUT_MAP[view] ?? [];
  return [...GLOBAL_SHORTCUTS, ...viewShortcuts];
}

/**
 * Returns the unique categories present in a list of shortcut entries,
 * preserving insertion order.
 */
export function getCategories(entries: ShortcutEntry[]): string[] {
  const seen = new Set<string>();
  const result: string[] = [];
  for (const entry of entries) {
    if (!seen.has(entry.category)) {
      seen.add(entry.category);
      result.push(entry.category);
    }
  }
  return result;
}

/**
 * Groups shortcut entries by category.
 */
export function groupByCategory(entries: ShortcutEntry[]): Map<string, ShortcutEntry[]> {
  const groups = new Map<string, ShortcutEntry[]>();
  for (const entry of entries) {
    const group = groups.get(entry.category);
    if (group) {
      group.push(entry);
    } else {
      groups.set(entry.category, [entry]);
    }
  }
  return groups;
}
