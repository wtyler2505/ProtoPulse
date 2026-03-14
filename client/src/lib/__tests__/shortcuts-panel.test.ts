import { describe, it, expect } from 'vitest';
import {
  getShortcutsForView,
  getCategories,
  groupByCategory,
  GLOBAL_SHORTCUTS,
  ARCHITECTURE_SHORTCUTS,
  SCHEMATIC_SHORTCUTS,
  PCB_SHORTCUTS,
  BOM_SHORTCUTS,
  COMPONENT_EDITOR_SHORTCUTS,
  BREADBOARD_SHORTCUTS,
  SIMULATION_SHORTCUTS,
} from '../shortcuts-panel';
import type { ShortcutEntry } from '../shortcuts-panel';
import type { ViewMode } from '@/lib/project-context';

describe('shortcuts-panel', () => {
  // ---------------------------------------------------------------------------
  // GLOBAL_SHORTCUTS
  // ---------------------------------------------------------------------------

  describe('GLOBAL_SHORTCUTS', () => {
    it('contains Ctrl+K for command palette', () => {
      expect(GLOBAL_SHORTCUTS).toContainEqual(
        expect.objectContaining({ key: 'Ctrl+K', category: 'Global' }),
      );
    });

    it('contains Ctrl+S for save', () => {
      expect(GLOBAL_SHORTCUTS).toContainEqual(
        expect.objectContaining({ key: 'Ctrl+S', category: 'Global' }),
      );
    });

    it('contains Ctrl+Z for undo', () => {
      expect(GLOBAL_SHORTCUTS).toContainEqual(
        expect.objectContaining({ key: 'Ctrl+Z', category: 'Global' }),
      );
    });

    it('contains Ctrl+Shift+Z for redo', () => {
      expect(GLOBAL_SHORTCUTS).toContainEqual(
        expect.objectContaining({ key: 'Ctrl+Shift+Z', category: 'Global' }),
      );
    });

    it('contains ? for toggle shortcuts panel', () => {
      expect(GLOBAL_SHORTCUTS).toContainEqual(
        expect.objectContaining({ key: '?', category: 'Global' }),
      );
    });

    it('all entries have required fields', () => {
      for (const entry of GLOBAL_SHORTCUTS) {
        expect(entry.key).toBeTruthy();
        expect(entry.description).toBeTruthy();
        expect(entry.category).toBe('Global');
      }
    });
  });

  // ---------------------------------------------------------------------------
  // View-specific shortcut arrays
  // ---------------------------------------------------------------------------

  describe('ARCHITECTURE_SHORTCUTS', () => {
    it('includes N for new node', () => {
      expect(ARCHITECTURE_SHORTCUTS).toContainEqual(
        expect.objectContaining({ key: 'N', description: 'New node' }),
      );
    });

    it('includes Del for delete', () => {
      expect(ARCHITECTURE_SHORTCUTS).toContainEqual(
        expect.objectContaining({ key: 'Del', description: 'Delete selected' }),
      );
    });

    it('all entries have category Architecture', () => {
      for (const entry of ARCHITECTURE_SHORTCUTS) {
        expect(entry.category).toBe('Architecture');
      }
    });
  });

  describe('SCHEMATIC_SHORTCUTS', () => {
    it('includes W for wire tool', () => {
      expect(SCHEMATIC_SHORTCUTS).toContainEqual(
        expect.objectContaining({ key: 'W', description: 'Wire tool' }),
      );
    });

    it('includes R for rotate', () => {
      expect(SCHEMATIC_SHORTCUTS).toContainEqual(
        expect.objectContaining({ key: 'R', description: 'Rotate component' }),
      );
    });
  });

  describe('PCB_SHORTCUTS', () => {
    it('includes T for trace tool', () => {
      expect(PCB_SHORTCUTS).toContainEqual(
        expect.objectContaining({ key: 'T', description: 'Trace tool' }),
      );
    });

    it('includes V for via tool', () => {
      expect(PCB_SHORTCUTS).toContainEqual(
        expect.objectContaining({ key: 'V', description: 'Via tool' }),
      );
    });

    it('includes F for flip side', () => {
      expect(PCB_SHORTCUTS).toContainEqual(
        expect.objectContaining({ key: 'F' }),
      );
    });
  });

  describe('BOM_SHORTCUTS', () => {
    it('includes + for add item', () => {
      expect(BOM_SHORTCUTS).toContainEqual(
        expect.objectContaining({ key: '+', description: 'Add item' }),
      );
    });

    it('includes E for edit', () => {
      expect(BOM_SHORTCUTS).toContainEqual(
        expect.objectContaining({ key: 'E', description: 'Edit selected' }),
      );
    });
  });

  describe('COMPONENT_EDITOR_SHORTCUTS', () => {
    it('includes tool letter shortcuts', () => {
      const keys = COMPONENT_EDITOR_SHORTCUTS.map((s) => s.key);
      expect(keys).toContain('S');
      expect(keys).toContain('R');
      expect(keys).toContain('C');
      expect(keys).toContain('T');
      expect(keys).toContain('L');
      expect(keys).toContain('P');
    });
  });

  describe('BREADBOARD_SHORTCUTS', () => {
    it('includes numbered tool shortcuts', () => {
      const keys = BREADBOARD_SHORTCUTS.map((s) => s.key);
      expect(keys).toContain('1');
      expect(keys).toContain('2');
      expect(keys).toContain('3');
    });
  });

  describe('SIMULATION_SHORTCUTS', () => {
    it('includes Ctrl+Enter for run', () => {
      expect(SIMULATION_SHORTCUTS).toContainEqual(
        expect.objectContaining({ key: 'Ctrl+Enter' }),
      );
    });
  });

  // ---------------------------------------------------------------------------
  // getShortcutsForView
  // ---------------------------------------------------------------------------

  describe('getShortcutsForView', () => {
    it('returns global shortcuts for any view', () => {
      const result = getShortcutsForView('dashboard');
      const globalKeys = GLOBAL_SHORTCUTS.map((s) => s.key);
      for (const key of globalKeys) {
        expect(result.some((e) => e.key === key)).toBe(true);
      }
    });

    it('returns global + architecture shortcuts for architecture view', () => {
      const result = getShortcutsForView('architecture');
      expect(result.length).toBe(GLOBAL_SHORTCUTS.length + ARCHITECTURE_SHORTCUTS.length);
    });

    it('returns global + schematic shortcuts for schematic view', () => {
      const result = getShortcutsForView('schematic');
      expect(result.length).toBe(GLOBAL_SHORTCUTS.length + SCHEMATIC_SHORTCUTS.length);
    });

    it('returns global + pcb shortcuts for pcb view', () => {
      const result = getShortcutsForView('pcb');
      expect(result.length).toBe(GLOBAL_SHORTCUTS.length + PCB_SHORTCUTS.length);
    });

    it('returns global + bom shortcuts for procurement view', () => {
      const result = getShortcutsForView('procurement');
      expect(result.length).toBe(GLOBAL_SHORTCUTS.length + BOM_SHORTCUTS.length);
    });

    it('returns global + component editor shortcuts for component_editor', () => {
      const result = getShortcutsForView('component_editor');
      expect(result.length).toBe(GLOBAL_SHORTCUTS.length + COMPONENT_EDITOR_SHORTCUTS.length);
    });

    it('returns global + breadboard shortcuts for breadboard view', () => {
      const result = getShortcutsForView('breadboard');
      expect(result.length).toBe(GLOBAL_SHORTCUTS.length + BREADBOARD_SHORTCUTS.length);
    });

    it('returns global + simulation shortcuts for simulation view', () => {
      const result = getShortcutsForView('simulation');
      expect(result.length).toBe(GLOBAL_SHORTCUTS.length + SIMULATION_SHORTCUTS.length);
    });

    it('returns only global shortcuts for views without specific shortcuts', () => {
      const viewsWithNoSpecific: ViewMode[] = [
        'dashboard',
        'output',
        'validation',
        'design_history',
        'lifecycle',
        'kanban',
        'knowledge',
        'ordering',
      ];
      for (const view of viewsWithNoSpecific) {
        const result = getShortcutsForView(view);
        expect(result.length).toBe(GLOBAL_SHORTCUTS.length);
        expect(result).toEqual(GLOBAL_SHORTCUTS);
      }
    });

    it('global shortcuts come first in the result', () => {
      const result = getShortcutsForView('architecture');
      const firstEntries = result.slice(0, GLOBAL_SHORTCUTS.length);
      expect(firstEntries).toEqual(GLOBAL_SHORTCUTS);
    });

    it('view-specific shortcuts come after global shortcuts', () => {
      const result = getShortcutsForView('pcb');
      const viewEntries = result.slice(GLOBAL_SHORTCUTS.length);
      expect(viewEntries).toEqual(PCB_SHORTCUTS);
    });

    it('returns a new array each call (no shared reference)', () => {
      const a = getShortcutsForView('architecture');
      const b = getShortcutsForView('architecture');
      expect(a).not.toBe(b);
      expect(a).toEqual(b);
    });
  });

  // ---------------------------------------------------------------------------
  // getCategories
  // ---------------------------------------------------------------------------

  describe('getCategories', () => {
    it('returns unique categories in insertion order', () => {
      const entries: ShortcutEntry[] = [
        { key: 'A', description: 'a', category: 'Global' },
        { key: 'B', description: 'b', category: 'View' },
        { key: 'C', description: 'c', category: 'Global' },
        { key: 'D', description: 'd', category: 'View' },
      ];
      expect(getCategories(entries)).toEqual(['Global', 'View']);
    });

    it('returns empty array for empty input', () => {
      expect(getCategories([])).toEqual([]);
    });

    it('preserves order from getShortcutsForView (Global first)', () => {
      const result = getShortcutsForView('architecture');
      const categories = getCategories(result);
      expect(categories[0]).toBe('Global');
      expect(categories[1]).toBe('Architecture');
    });
  });

  // ---------------------------------------------------------------------------
  // groupByCategory
  // ---------------------------------------------------------------------------

  describe('groupByCategory', () => {
    it('groups entries by category', () => {
      const entries: ShortcutEntry[] = [
        { key: 'A', description: 'a', category: 'Alpha' },
        { key: 'B', description: 'b', category: 'Beta' },
        { key: 'C', description: 'c', category: 'Alpha' },
      ];
      const grouped = groupByCategory(entries);
      expect(grouped.size).toBe(2);
      expect(grouped.get('Alpha')).toHaveLength(2);
      expect(grouped.get('Beta')).toHaveLength(1);
    });

    it('returns empty map for empty input', () => {
      const grouped = groupByCategory([]);
      expect(grouped.size).toBe(0);
    });

    it('groups architecture view shortcuts correctly', () => {
      const result = getShortcutsForView('architecture');
      const grouped = groupByCategory(result);
      expect(grouped.has('Global')).toBe(true);
      expect(grouped.has('Architecture')).toBe(true);
      expect(grouped.get('Global')).toHaveLength(GLOBAL_SHORTCUTS.length);
      expect(grouped.get('Architecture')).toHaveLength(ARCHITECTURE_SHORTCUTS.length);
    });

    it('preserves entry order within groups', () => {
      const entries: ShortcutEntry[] = [
        { key: '1', description: 'first', category: 'A' },
        { key: '2', description: 'second', category: 'A' },
        { key: '3', description: 'third', category: 'A' },
      ];
      const grouped = groupByCategory(entries);
      const group = grouped.get('A')!;
      expect(group[0].key).toBe('1');
      expect(group[1].key).toBe('2');
      expect(group[2].key).toBe('3');
    });
  });
});
