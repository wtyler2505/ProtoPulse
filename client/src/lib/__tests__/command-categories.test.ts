import { describe, it, expect } from 'vitest';
import {
  getCommandCategory,
  categorizeCommands,
  CATEGORY_LABELS,
  CATEGORY_ORDER,
} from '../command-categories';
import type {
  CommandCategory,
  CommandItem,
  CategorizedCommand,
} from '../command-categories';

describe('command-categories', () => {
  // -------------------------------------------------------------------------
  // CATEGORY_LABELS
  // -------------------------------------------------------------------------
  describe('CATEGORY_LABELS', () => {
    it('has a label and icon for every category in CATEGORY_ORDER', () => {
      for (const cat of CATEGORY_ORDER) {
        const meta = CATEGORY_LABELS[cat];
        expect(meta).toBeDefined();
        expect(meta.label).toBeTruthy();
        expect(meta.icon).toBeDefined();
      }
    });

    it('has exactly 6 categories', () => {
      expect(Object.keys(CATEGORY_LABELS)).toHaveLength(6);
    });
  });

  // -------------------------------------------------------------------------
  // CATEGORY_ORDER
  // -------------------------------------------------------------------------
  describe('CATEGORY_ORDER', () => {
    it('follows design -> simulate -> manufacture -> collaborate -> navigation -> settings', () => {
      expect(CATEGORY_ORDER).toEqual([
        'design',
        'simulate',
        'manufacture',
        'collaborate',
        'navigation',
        'settings',
      ]);
    });

    it('covers all category labels', () => {
      const labelKeys = Object.keys(CATEGORY_LABELS) as CommandCategory[];
      for (const key of labelKeys) {
        expect(CATEGORY_ORDER).toContain(key);
      }
    });
  });

  // -------------------------------------------------------------------------
  // getCommandCategory — direct ID matches
  // -------------------------------------------------------------------------
  describe('getCommandCategory — direct ID matches', () => {
    const directMappings: Array<{ id: string; expected: CommandCategory }> = [
      { id: 'nav-architecture', expected: 'design' },
      { id: 'nav-schematic', expected: 'design' },
      { id: 'nav-pcb', expected: 'design' },
      { id: 'nav-breadboard', expected: 'design' },
      { id: 'nav-component-editor', expected: 'design' },
      { id: 'nav-circuit-code', expected: 'design' },
      { id: 'nav-generative-design', expected: 'design' },
      { id: 'nav-starter-circuits', expected: 'design' },
      { id: 'nav-calculators', expected: 'design' },
      { id: 'nav-simulation', expected: 'simulate' },
      { id: 'nav-digital-twin', expected: 'simulate' },
      { id: 'action-run-drc', expected: 'simulate' },
      { id: 'nav-output', expected: 'manufacture' },
      { id: 'nav-ordering', expected: 'manufacture' },
      { id: 'nav-viewer-3d', expected: 'manufacture' },
      { id: 'action-export', expected: 'manufacture' },
      { id: 'nav-procurement', expected: 'manufacture' },
      { id: 'nav-storage', expected: 'manufacture' },
      { id: 'nav-community', expected: 'collaborate' },
      { id: 'nav-kanban', expected: 'collaborate' },
      { id: 'nav-knowledge', expected: 'collaborate' },
      { id: 'nav-comments', expected: 'collaborate' },
      { id: 'nav-lifecycle', expected: 'collaborate' },
      { id: 'nav-design-history', expected: 'collaborate' },
      { id: 'nav-dashboard', expected: 'navigation' },
      { id: 'nav-arduino', expected: 'navigation' },
      { id: 'nav-serial-monitor', expected: 'navigation' },
      { id: 'panel-sidebar', expected: 'settings' },
      { id: 'panel-chat', expected: 'settings' },
    ];

    for (const { id, expected } of directMappings) {
      it(`maps "${id}" to "${expected}"`, () => {
        expect(getCommandCategory({ id, label: 'Test' })).toBe(expected);
      });
    }
  });

  // -------------------------------------------------------------------------
  // getCommandCategory — keyword fallback
  // -------------------------------------------------------------------------
  describe('getCommandCategory — keyword fallback', () => {
    it('categorizes by label keyword when ID is unknown', () => {
      expect(getCommandCategory({ id: 'unknown-1', label: 'Schematic Editor' })).toBe('design');
    });

    it('categorizes by keywords array when ID and label do not match', () => {
      expect(getCommandCategory({ id: 'unknown-2', label: 'Foo', keywords: ['simulate'] })).toBe('simulate');
    });

    it('falls back to "navigation" when nothing matches', () => {
      expect(getCommandCategory({ id: 'unknown-3', label: 'Xyzzy', keywords: ['qqq'] })).toBe('navigation');
    });

    it('falls back to "navigation" when no keywords provided', () => {
      expect(getCommandCategory({ id: 'unknown-4', label: 'NoMatch' })).toBe('navigation');
    });

    it('matches "export" keyword to manufacture', () => {
      expect(getCommandCategory({ id: 'custom-export', label: 'Custom Export Tool', keywords: ['export'] })).toBe('manufacture');
    });

    it('matches "community" keyword to collaborate', () => {
      expect(getCommandCategory({ id: 'custom-community', label: 'My Library', keywords: ['community'] })).toBe('collaborate');
    });

    it('matches "settings" keyword to settings', () => {
      expect(getCommandCategory({ id: 'custom-settings', label: 'Preferences', keywords: ['settings'] })).toBe('settings');
    });

    it('matches "dashboard" keyword to navigation', () => {
      expect(getCommandCategory({ id: 'custom-dash', label: 'Overview', keywords: ['dashboard'] })).toBe('navigation');
    });

    it('is case-insensitive for label matching', () => {
      expect(getCommandCategory({ id: 'upper', label: 'SIMULATION View' })).toBe('simulate');
    });

    it('is case-insensitive for keyword matching', () => {
      expect(getCommandCategory({ id: 'upper-kw', label: 'Foo', keywords: ['GERBER'] })).toBe('manufacture');
    });
  });

  // -------------------------------------------------------------------------
  // categorizeCommands
  // -------------------------------------------------------------------------
  describe('categorizeCommands', () => {
    const sampleCommands: CommandItem[] = [
      { id: 'nav-architecture', label: 'Architecture' },
      { id: 'nav-schematic', label: 'Schematic' },
      { id: 'nav-simulation', label: 'Simulation' },
      { id: 'nav-output', label: 'Exports' },
      { id: 'nav-kanban', label: 'Task Board' },
      { id: 'panel-sidebar', label: 'Hide Sidebar' },
      { id: 'nav-dashboard', label: 'Dashboard' },
    ];

    it('returns groups in CATEGORY_ORDER', () => {
      const result = categorizeCommands(sampleCommands);
      const categories = result.map((g) => g.category);
      // design, simulate, manufacture, collaborate, navigation, settings — only present ones
      expect(categories).toEqual(['design', 'simulate', 'manufacture', 'collaborate', 'navigation', 'settings']);
    });

    it('omits empty categories', () => {
      const result = categorizeCommands([
        { id: 'nav-architecture', label: 'Architecture' },
      ]);
      expect(result).toHaveLength(1);
      expect(result[0].category).toBe('design');
    });

    it('sorts commands alphabetically within each category', () => {
      const result = categorizeCommands([
        { id: 'nav-pcb', label: 'PCB Layout' },
        { id: 'nav-architecture', label: 'Architecture' },
        { id: 'nav-breadboard', label: 'Breadboard' },
      ]);
      expect(result).toHaveLength(1);
      const labels = result[0].commands.map((c) => c.label);
      expect(labels).toEqual(['Architecture', 'Breadboard', 'PCB Layout']);
    });

    it('handles empty input', () => {
      expect(categorizeCommands([])).toEqual([]);
    });

    it('preserves all original command properties', () => {
      interface ExtendedCommand extends CommandItem {
        action: () => void;
        shortcut?: string;
      }
      const actionFn = () => {};
      const commands: ExtendedCommand[] = [
        { id: 'nav-architecture', label: 'Architecture', action: actionFn, shortcut: '1', keywords: ['block'] },
      ];
      const result = categorizeCommands(commands);
      expect(result[0].commands[0].action).toBe(actionFn);
      expect(result[0].commands[0].shortcut).toBe('1');
      expect(result[0].commands[0].keywords).toEqual(['block']);
    });

    it('groups all navigate items from the real command palette correctly', () => {
      const realItems: CommandItem[] = [
        { id: 'nav-architecture', label: 'Architecture', keywords: ['block', 'diagram'] },
        { id: 'nav-schematic', label: 'Schematic', keywords: ['circuit', 'net', 'wire'] },
        { id: 'nav-pcb', label: 'PCB Layout', keywords: ['board', 'trace', 'footprint'] },
        { id: 'nav-breadboard', label: 'Breadboard', keywords: ['prototype', 'wiring'] },
        { id: 'nav-component-editor', label: 'Component Editor', keywords: ['part', 'symbol'] },
        { id: 'nav-procurement', label: 'Procurement', keywords: ['bom', 'bill', 'materials', 'cost'] },
        { id: 'nav-validation', label: 'Validation', keywords: ['drc', 'check', 'rule'] },
        { id: 'nav-output', label: 'Exports', keywords: ['export', 'gerber', 'kicad'] },
        { id: 'nav-simulation', label: 'Simulation', keywords: ['spice', 'simulate', 'analysis', 'waveform'] },
        { id: 'nav-kanban', label: 'Task Board', keywords: ['kanban', 'tasks', 'board', 'todo'] },
        { id: 'nav-knowledge', label: 'Learn', keywords: ['knowledge', 'learn', 'article'] },
        { id: 'nav-viewer-3d', label: '3D View', keywords: ['3d', 'viewer', 'board', 'mechanical'] },
        { id: 'nav-community', label: 'Community', keywords: ['community', 'library', 'shared'] },
        { id: 'nav-ordering', label: 'Order PCB', keywords: ['order', 'pcb', 'fabricate', 'manufacture'] },
        { id: 'nav-storage', label: 'Inventory', keywords: ['inventory', 'storage', 'stock'] },
        { id: 'nav-circuit-code', label: 'Circuit Code', keywords: ['code', 'arduino', 'firmware'] },
        { id: 'nav-generative-design', label: 'Generative Design', keywords: ['generative', 'evolve'] },
        { id: 'nav-digital-twin', label: 'Digital Twin', keywords: ['twin', 'iot', 'telemetry'] },
        { id: 'panel-sidebar', label: 'Hide Sidebar' },
        { id: 'panel-chat', label: 'Show AI Assistant' },
        { id: 'action-run-drc', label: 'Run Design Rule Check', keywords: ['validate', 'check', 'drc'] },
        { id: 'action-export', label: 'Export Project', keywords: ['export', 'download', 'gerber'] },
      ];

      const result = categorizeCommands(realItems);

      // Design should include architecture, schematic, pcb, breadboard, component editor, circuit code, generative, starter
      const designGroup = result.find((g) => g.category === 'design');
      expect(designGroup).toBeDefined();
      expect(designGroup!.commands.map((c) => c.id)).toContain('nav-architecture');
      expect(designGroup!.commands.map((c) => c.id)).toContain('nav-schematic');
      expect(designGroup!.commands.map((c) => c.id)).toContain('nav-pcb');
      expect(designGroup!.commands.map((c) => c.id)).toContain('nav-circuit-code');

      // Simulate should include simulation, digital twin, run DRC
      const simGroup = result.find((g) => g.category === 'simulate');
      expect(simGroup).toBeDefined();
      expect(simGroup!.commands.map((c) => c.id)).toContain('nav-simulation');
      expect(simGroup!.commands.map((c) => c.id)).toContain('nav-digital-twin');
      expect(simGroup!.commands.map((c) => c.id)).toContain('action-run-drc');

      // Manufacture should include output, ordering, viewer-3d, procurement, storage, export action
      const mfgGroup = result.find((g) => g.category === 'manufacture');
      expect(mfgGroup).toBeDefined();
      expect(mfgGroup!.commands.map((c) => c.id)).toContain('nav-output');
      expect(mfgGroup!.commands.map((c) => c.id)).toContain('nav-ordering');
      expect(mfgGroup!.commands.map((c) => c.id)).toContain('nav-procurement');

      // Collaborate should include community, kanban, knowledge
      const collabGroup = result.find((g) => g.category === 'collaborate');
      expect(collabGroup).toBeDefined();
      expect(collabGroup!.commands.map((c) => c.id)).toContain('nav-community');
      expect(collabGroup!.commands.map((c) => c.id)).toContain('nav-kanban');
      expect(collabGroup!.commands.map((c) => c.id)).toContain('nav-knowledge');

      // Settings should include panel items
      const settingsGroup = result.find((g) => g.category === 'settings');
      expect(settingsGroup).toBeDefined();
      expect(settingsGroup!.commands.map((c) => c.id)).toContain('panel-sidebar');
      expect(settingsGroup!.commands.map((c) => c.id)).toContain('panel-chat');
    });

    it('returns every input command exactly once', () => {
      const commands: CommandItem[] = [
        { id: 'nav-architecture', label: 'Architecture' },
        { id: 'nav-simulation', label: 'Simulation' },
        { id: 'nav-output', label: 'Exports' },
        { id: 'nav-kanban', label: 'Tasks' },
        { id: 'panel-sidebar', label: 'Sidebar' },
        { id: 'nav-dashboard', label: 'Dashboard' },
        { id: 'unknown-x', label: 'Mystery' },
      ];
      const result = categorizeCommands(commands);
      const allIds = result.flatMap((g) => g.commands.map((c) => c.id));
      expect(allIds).toHaveLength(commands.length);
      for (const cmd of commands) {
        expect(allIds).toContain(cmd.id);
      }
    });

    it('handles commands with duplicate IDs gracefully', () => {
      const commands: CommandItem[] = [
        { id: 'nav-pcb', label: 'PCB Layout' },
        { id: 'nav-pcb', label: 'PCB Layout Copy' },
      ];
      const result = categorizeCommands(commands);
      const allIds = result.flatMap((g) => g.commands.map((c) => c.id));
      expect(allIds).toHaveLength(2);
    });
  });

  // -------------------------------------------------------------------------
  // Edge cases
  // -------------------------------------------------------------------------
  describe('edge cases', () => {
    it('handles command with empty label and no keywords', () => {
      const result = getCommandCategory({ id: 'empty', label: '' });
      expect(CATEGORY_ORDER).toContain(result);
    });

    it('handles command with empty keywords array', () => {
      const result = getCommandCategory({ id: 'empty-kw', label: 'Foo', keywords: [] });
      expect(CATEGORY_ORDER).toContain(result);
    });

    it('validation nav item maps to simulate via keyword fallback', () => {
      // nav-validation is not in the direct map, but 'validate'/'check'/'drc' keywords
      // should catch it via the keyword path
      const result = getCommandCategory({
        id: 'nav-validation',
        label: 'Validation',
        keywords: ['drc', 'check', 'rule'],
      });
      expect(result).toBe('simulate');
    });
  });
});
