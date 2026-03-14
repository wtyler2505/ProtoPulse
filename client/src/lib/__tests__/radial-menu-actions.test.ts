import { describe, it, expect } from 'vitest';
import {
  getActionsForContext,
  getSupportedContextTypes,
} from '@/lib/radial-menu-actions';
import type { MenuContext, MenuContextType, TargetKind } from '@/lib/radial-menu-actions';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function ctx(view: MenuContextType, target: TargetKind, id?: string): MenuContext {
  return { view, target, targetId: id };
}

// ---------------------------------------------------------------------------
// getActionsForContext
// ---------------------------------------------------------------------------

describe('getActionsForContext', () => {
  // ---------- Architecture ----------

  describe('architecture view', () => {
    it('returns 6 actions for a node target', () => {
      const actions = getActionsForContext(ctx('architecture', 'node'));
      expect(actions.length).toBe(6);
    });

    it('includes edit, delete, connect, change_type, duplicate, add_to_bom for nodes', () => {
      const ids = getActionsForContext(ctx('architecture', 'node')).map((a) => a.id);
      expect(ids).toContain('edit');
      expect(ids).toContain('delete');
      expect(ids).toContain('connect');
      expect(ids).toContain('change_type');
      expect(ids).toContain('duplicate');
      expect(ids).toContain('add_to_bom');
    });

    it('marks delete as destructive', () => {
      const del = getActionsForContext(ctx('architecture', 'node')).find((a) => a.id === 'delete');
      expect(del?.destructive).toBe(true);
    });

    it('returns canvas actions for non-node targets', () => {
      const actions = getActionsForContext(ctx('architecture', 'canvas'));
      expect(actions.length).toBeGreaterThanOrEqual(2);
      const ids = actions.map((a) => a.id);
      expect(ids).toContain('add_node');
      expect(ids).toContain('select_all');
    });

    it('returns canvas actions for wire target (fallback)', () => {
      const actions = getActionsForContext(ctx('architecture', 'wire'));
      expect(actions.length).toBeGreaterThanOrEqual(2);
    });
  });

  // ---------- Schematic ----------

  describe('schematic view', () => {
    it('returns 6 actions for a node target', () => {
      const actions = getActionsForContext(ctx('schematic', 'node'));
      expect(actions.length).toBe(6);
    });

    it('includes rotate, mirror, properties, delete, add_wire, datasheet for nodes', () => {
      const ids = getActionsForContext(ctx('schematic', 'node')).map((a) => a.id);
      expect(ids).toContain('rotate');
      expect(ids).toContain('mirror');
      expect(ids).toContain('edit_properties');
      expect(ids).toContain('delete');
      expect(ids).toContain('add_wire');
      expect(ids).toContain('view_datasheet');
    });

    it('returns canvas actions for empty canvas click', () => {
      const actions = getActionsForContext(ctx('schematic', 'canvas'));
      const ids = actions.map((a) => a.id);
      expect(ids).toContain('add_component');
      expect(ids).toContain('add_wire');
    });
  });

  // ---------- PCB ----------

  describe('pcb view', () => {
    it('returns 6 actions for a node target', () => {
      const actions = getActionsForContext(ctx('pcb', 'node'));
      expect(actions.length).toBe(6);
    });

    it('includes rotate, flip_side, edit_pad, route_trace, run_drc, measure', () => {
      const ids = getActionsForContext(ctx('pcb', 'node')).map((a) => a.id);
      expect(ids).toContain('rotate');
      expect(ids).toContain('flip_side');
      expect(ids).toContain('edit_pad');
      expect(ids).toContain('route_trace');
      expect(ids).toContain('run_drc');
      expect(ids).toContain('measure');
    });

    it('returns canvas actions for empty area', () => {
      const actions = getActionsForContext(ctx('pcb', 'canvas'));
      const ids = actions.map((a) => a.id);
      expect(ids).toContain('add_via');
      expect(ids).toContain('run_drc');
      expect(ids).toContain('measure');
    });
  });

  // ---------- Breadboard ----------

  describe('breadboard view', () => {
    it('returns 6 actions for a node target', () => {
      const actions = getActionsForContext(ctx('breadboard', 'node'));
      expect(actions.length).toBe(6);
    });

    it('includes rotate, move, properties, delete, add_wire, datasheet', () => {
      const ids = getActionsForContext(ctx('breadboard', 'node')).map((a) => a.id);
      expect(ids).toContain('rotate');
      expect(ids).toContain('move');
      expect(ids).toContain('edit_properties');
      expect(ids).toContain('delete');
      expect(ids).toContain('add_wire');
      expect(ids).toContain('view_datasheet');
    });

    it('returns canvas actions for empty area', () => {
      const actions = getActionsForContext(ctx('breadboard', 'canvas'));
      const ids = actions.map((a) => a.id);
      expect(ids).toContain('add_component');
      expect(ids).toContain('add_wire');
    });
  });

  // ---------- BOM ----------

  describe('bom view', () => {
    it('returns 4 actions for a bom_row target', () => {
      const actions = getActionsForContext(ctx('bom', 'bom_row'));
      expect(actions.length).toBe(4);
    });

    it('includes edit_quantity, find_alternates, view_datasheet, remove', () => {
      const ids = getActionsForContext(ctx('bom', 'bom_row')).map((a) => a.id);
      expect(ids).toContain('edit_quantity');
      expect(ids).toContain('find_alternates');
      expect(ids).toContain('view_datasheet');
      expect(ids).toContain('remove');
    });

    it('marks remove as destructive', () => {
      const rem = getActionsForContext(ctx('bom', 'bom_row')).find((a) => a.id === 'remove');
      expect(rem?.destructive).toBe(true);
    });

    it('returns empty array for non-row targets in bom', () => {
      const actions = getActionsForContext(ctx('bom', 'canvas'));
      expect(actions).toEqual([]);
    });
  });

  // ---------- Edge cases ----------

  describe('edge cases', () => {
    it('all items have an id, label, and icon', () => {
      const contexts: MenuContext[] = [
        ctx('architecture', 'node'),
        ctx('schematic', 'node'),
        ctx('pcb', 'node'),
        ctx('breadboard', 'node'),
        ctx('bom', 'bom_row'),
        ctx('architecture', 'canvas'),
        ctx('schematic', 'canvas'),
        ctx('pcb', 'canvas'),
        ctx('breadboard', 'canvas'),
      ];
      for (const c of contexts) {
        const actions = getActionsForContext(c);
        for (const a of actions) {
          expect(a.id).toBeTruthy();
          expect(a.label).toBeTruthy();
          expect(a.icon).toBeDefined();
        }
      }
    });

    it('no context returns more than 8 items', () => {
      const contexts: MenuContext[] = [
        ctx('architecture', 'node'),
        ctx('schematic', 'node'),
        ctx('pcb', 'node'),
        ctx('breadboard', 'node'),
        ctx('bom', 'bom_row'),
        ctx('architecture', 'canvas'),
        ctx('schematic', 'canvas'),
        ctx('pcb', 'canvas'),
        ctx('breadboard', 'canvas'),
      ];
      for (const c of contexts) {
        expect(getActionsForContext(c).length).toBeLessThanOrEqual(8);
      }
    });

    it('passes targetId through to context without error', () => {
      const actions = getActionsForContext(ctx('architecture', 'node', 'node-123'));
      expect(actions.length).toBeGreaterThan(0);
    });

    it('each item id is unique within its action set', () => {
      const contexts: MenuContext[] = [
        ctx('architecture', 'node'),
        ctx('schematic', 'node'),
        ctx('pcb', 'node'),
        ctx('breadboard', 'node'),
        ctx('bom', 'bom_row'),
      ];
      for (const c of contexts) {
        const actions = getActionsForContext(c);
        const ids = actions.map((a) => a.id);
        expect(new Set(ids).size).toBe(ids.length);
      }
    });
  });
});

// ---------------------------------------------------------------------------
// getSupportedContextTypes
// ---------------------------------------------------------------------------

describe('getSupportedContextTypes', () => {
  it('returns all 5 supported context types', () => {
    const types = getSupportedContextTypes();
    expect(types).toHaveLength(5);
    expect(types).toContain('architecture');
    expect(types).toContain('schematic');
    expect(types).toContain('pcb');
    expect(types).toContain('breadboard');
    expect(types).toContain('bom');
  });

  it('returns a new array each call', () => {
    const a = getSupportedContextTypes();
    const b = getSupportedContextTypes();
    expect(a).not.toBe(b);
    expect(a).toEqual(b);
  });
});
