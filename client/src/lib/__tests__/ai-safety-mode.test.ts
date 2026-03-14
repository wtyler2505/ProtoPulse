import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import {
  AISafetyModeManager,
  useAISafetyMode,
} from '../ai-safety-mode';
import type {
  SafetyClassification,
  SafetyInfo,
} from '../ai-safety-mode';
import { renderHook, act } from '@testing-library/react';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function freshManager(): AISafetyModeManager {
  AISafetyModeManager.resetInstance();
  localStorage.clear();
  return AISafetyModeManager.getInstance();
}

// ---------------------------------------------------------------------------
// AISafetyModeManager — Singleton
// ---------------------------------------------------------------------------

describe('AISafetyModeManager', () => {
  beforeEach(() => {
    AISafetyModeManager.resetInstance();
    localStorage.clear();
  });

  afterEach(() => {
    AISafetyModeManager.resetInstance();
  });

  describe('singleton', () => {
    it('returns the same instance on repeated calls', () => {
      const a = AISafetyModeManager.getInstance();
      const b = AISafetyModeManager.getInstance();
      expect(a).toBe(b);
    });

    it('resets the instance correctly', () => {
      const a = AISafetyModeManager.getInstance();
      AISafetyModeManager.resetInstance();
      const b = AISafetyModeManager.getInstance();
      expect(a).not.toBe(b);
    });
  });

  // -------------------------------------------------------------------------
  // Default state
  // -------------------------------------------------------------------------

  describe('default state', () => {
    it('is enabled by default', () => {
      const mgr = freshManager();
      expect(mgr.enabled).toBe(true);
    });

    it('has no dismissed actions by default', () => {
      const mgr = freshManager();
      expect(mgr.dismissedActions.size).toBe(0);
    });
  });

  // -------------------------------------------------------------------------
  // Toggle / setEnabled
  // -------------------------------------------------------------------------

  describe('toggle and setEnabled', () => {
    it('toggle flips enabled state', () => {
      const mgr = freshManager();
      expect(mgr.enabled).toBe(true);
      mgr.toggle();
      expect(mgr.enabled).toBe(false);
      mgr.toggle();
      expect(mgr.enabled).toBe(true);
    });

    it('setEnabled explicitly sets the state', () => {
      const mgr = freshManager();
      mgr.setEnabled(false);
      expect(mgr.enabled).toBe(false);
      mgr.setEnabled(true);
      expect(mgr.enabled).toBe(true);
    });

    it('setEnabled does not notify if value unchanged', () => {
      const mgr = freshManager();
      const fn = vi.fn();
      mgr.subscribe(fn);
      mgr.setEnabled(true); // already true
      expect(fn).not.toHaveBeenCalled();
    });

    it('toggle notifies subscribers', () => {
      const mgr = freshManager();
      const fn = vi.fn();
      mgr.subscribe(fn);
      mgr.toggle();
      expect(fn).toHaveBeenCalledTimes(1);
    });
  });

  // -------------------------------------------------------------------------
  // classifyAction
  // -------------------------------------------------------------------------

  describe('classifyAction', () => {
    it('classifies destructive actions correctly', () => {
      const mgr = freshManager();
      const destructive = [
        'remove_node', 'remove_edge', 'clear_canvas', 'clear_validation',
        'remove_bom_item', 'delete_node', 'delete_edge', 'clear_architecture',
        'replace_bom', 'delete_component',
      ];
      for (const action of destructive) {
        expect(mgr.classifyAction(action)).toBe('destructive');
      }
    });

    it('classifies caution actions correctly', () => {
      const mgr = freshManager();
      const caution = [
        'generate_architecture', 'add_multiple_nodes', 'modify_component',
        'update_node', 'connect_nodes', 'auto_layout', 'auto_fix_validation',
        'add_subcircuit', 'auto_assign_pins', 'optimize_bom', 'rename_project',
        'update_description', 'set_project_type', 'import_design',
      ];
      for (const action of caution) {
        expect(mgr.classifyAction(action)).toBe('caution');
      }
    });

    it('classifies safe actions correctly', () => {
      const mgr = freshManager();
      const safe = [
        'switch_view', 'project_summary', 'show_help', 'add_node',
        'add_bom_item', 'run_validation', 'export_bom_csv', 'undo', 'redo',
        'some_unknown_action',
      ];
      for (const action of safe) {
        expect(mgr.classifyAction(action)).toBe('safe');
      }
    });

    it('returns safe for empty string', () => {
      const mgr = freshManager();
      expect(mgr.classifyAction('')).toBe('safe');
    });
  });

  // -------------------------------------------------------------------------
  // getTeachingExplanation
  // -------------------------------------------------------------------------

  describe('getTeachingExplanation', () => {
    it('returns a specific explanation for known destructive actions', () => {
      const mgr = freshManager();
      const explanation = mgr.getTeachingExplanation('clear_canvas');
      expect(explanation).toContain('remove ALL');
      expect(explanation).toContain('cleared');
    });

    it('returns a specific explanation for known caution actions', () => {
      const mgr = freshManager();
      const explanation = mgr.getTeachingExplanation('generate_architecture');
      expect(explanation).toContain('generate');
      expect(explanation).toContain('overwritten');
    });

    it('returns a generic explanation for unknown actions', () => {
      const mgr = freshManager();
      const explanation = mgr.getTeachingExplanation('totally_new_action');
      expect(explanation).toContain('totally new action');
    });

    it('replaces underscores with spaces in generic explanation', () => {
      const mgr = freshManager();
      const explanation = mgr.getTeachingExplanation('foo_bar_baz');
      expect(explanation).toContain('foo bar baz');
    });
  });

  // -------------------------------------------------------------------------
  // getSafetyInfo
  // -------------------------------------------------------------------------

  describe('getSafetyInfo', () => {
    it('returns full safety info for destructive action', () => {
      const mgr = freshManager();
      const info: SafetyInfo = mgr.getSafetyInfo('remove_node');
      expect(info.classification).toBe('destructive');
      expect(info.explanation).toBeTruthy();
      expect(info.consequences.length).toBeGreaterThan(0);
    });

    it('returns full safety info for caution action', () => {
      const mgr = freshManager();
      const info: SafetyInfo = mgr.getSafetyInfo('generate_architecture');
      expect(info.classification).toBe('caution');
      expect(info.explanation).toContain('generate');
      expect(info.consequences.length).toBeGreaterThan(0);
    });

    it('returns generic info for unknown action', () => {
      const mgr = freshManager();
      const info: SafetyInfo = mgr.getSafetyInfo('unknown_action');
      expect(info.classification).toBe('safe');
      expect(info.consequences.length).toBeGreaterThan(0);
      expect(info.consequences[0].description).toContain('unknown action');
    });

    it('consequences are non-empty arrays for all known destructive actions', () => {
      const mgr = freshManager();
      const destructive = [
        'remove_node', 'remove_edge', 'clear_canvas', 'clear_validation',
        'remove_bom_item', 'delete_node', 'delete_edge', 'clear_architecture',
        'replace_bom', 'delete_component',
      ];
      for (const action of destructive) {
        const info = mgr.getSafetyInfo(action);
        expect(info.consequences.length).toBeGreaterThan(0);
      }
    });

    it('consequences are non-empty arrays for all known caution actions', () => {
      const mgr = freshManager();
      const caution = [
        'generate_architecture', 'add_multiple_nodes', 'modify_component',
        'update_node', 'connect_nodes', 'auto_layout', 'auto_fix_validation',
        'add_subcircuit', 'auto_assign_pins', 'optimize_bom', 'rename_project',
        'update_description', 'set_project_type', 'import_design',
      ];
      for (const action of caution) {
        const info = mgr.getSafetyInfo(action);
        expect(info.consequences.length).toBeGreaterThan(0);
      }
    });
  });

  // -------------------------------------------------------------------------
  // needsConfirmation
  // -------------------------------------------------------------------------

  describe('needsConfirmation', () => {
    it('returns true for destructive actions when enabled', () => {
      const mgr = freshManager();
      expect(mgr.needsConfirmation('remove_node')).toBe(true);
      expect(mgr.needsConfirmation('clear_canvas')).toBe(true);
    });

    it('returns true for caution actions when enabled', () => {
      const mgr = freshManager();
      expect(mgr.needsConfirmation('generate_architecture')).toBe(true);
      expect(mgr.needsConfirmation('optimize_bom')).toBe(true);
    });

    it('returns false for safe actions even when enabled', () => {
      const mgr = freshManager();
      expect(mgr.needsConfirmation('switch_view')).toBe(false);
      expect(mgr.needsConfirmation('add_node')).toBe(false);
      expect(mgr.needsConfirmation('show_help')).toBe(false);
    });

    it('returns false for all actions when disabled', () => {
      const mgr = freshManager();
      mgr.setEnabled(false);
      expect(mgr.needsConfirmation('remove_node')).toBe(false);
      expect(mgr.needsConfirmation('generate_architecture')).toBe(false);
      expect(mgr.needsConfirmation('switch_view')).toBe(false);
    });

    it('returns false for dismissed actions', () => {
      const mgr = freshManager();
      mgr.dismissAction('remove_node');
      expect(mgr.needsConfirmation('remove_node')).toBe(false);
      // Other destructive actions still need confirmation
      expect(mgr.needsConfirmation('clear_canvas')).toBe(true);
    });
  });

  // -------------------------------------------------------------------------
  // filterActions
  // -------------------------------------------------------------------------

  describe('filterActions', () => {
    it('separates actions into safe and needs-confirmation', () => {
      const mgr = freshManager();
      const result = mgr.filterActions([
        'switch_view', 'remove_node', 'add_node', 'generate_architecture',
      ]);
      expect(result.safe).toEqual(['switch_view', 'add_node']);
      expect(result.needsConfirmation).toEqual(['remove_node', 'generate_architecture']);
    });

    it('returns all as safe when disabled', () => {
      const mgr = freshManager();
      mgr.setEnabled(false);
      const result = mgr.filterActions(['remove_node', 'clear_canvas']);
      expect(result.safe).toEqual(['remove_node', 'clear_canvas']);
      expect(result.needsConfirmation).toEqual([]);
    });

    it('handles empty input', () => {
      const mgr = freshManager();
      const result = mgr.filterActions([]);
      expect(result.safe).toEqual([]);
      expect(result.needsConfirmation).toEqual([]);
    });

    it('respects dismissed actions', () => {
      const mgr = freshManager();
      mgr.dismissAction('remove_node');
      const result = mgr.filterActions(['remove_node', 'clear_canvas']);
      expect(result.safe).toEqual(['remove_node']);
      expect(result.needsConfirmation).toEqual(['clear_canvas']);
    });
  });

  // -------------------------------------------------------------------------
  // Dismiss / undismiss
  // -------------------------------------------------------------------------

  describe('dismiss and undismiss', () => {
    it('dismissAction adds to dismissed set', () => {
      const mgr = freshManager();
      mgr.dismissAction('remove_node');
      expect(mgr.isDismissed('remove_node')).toBe(true);
    });

    it('undismissAction removes from dismissed set', () => {
      const mgr = freshManager();
      mgr.dismissAction('remove_node');
      expect(mgr.isDismissed('remove_node')).toBe(true);
      mgr.undismissAction('remove_node');
      expect(mgr.isDismissed('remove_node')).toBe(false);
    });

    it('clearDismissed removes all dismissed actions', () => {
      const mgr = freshManager();
      mgr.dismissAction('remove_node');
      mgr.dismissAction('clear_canvas');
      mgr.dismissAction('generate_architecture');
      expect(mgr.dismissedActions.size).toBe(3);
      mgr.clearDismissed();
      expect(mgr.dismissedActions.size).toBe(0);
    });

    it('dismiss notifies subscribers', () => {
      const mgr = freshManager();
      const fn = vi.fn();
      mgr.subscribe(fn);
      mgr.dismissAction('remove_node');
      expect(fn).toHaveBeenCalledTimes(1);
    });

    it('undismiss notifies subscribers', () => {
      const mgr = freshManager();
      mgr.dismissAction('remove_node');
      const fn = vi.fn();
      mgr.subscribe(fn);
      mgr.undismissAction('remove_node');
      expect(fn).toHaveBeenCalledTimes(1);
    });

    it('clearDismissed notifies subscribers', () => {
      const mgr = freshManager();
      mgr.dismissAction('remove_node');
      const fn = vi.fn();
      mgr.subscribe(fn);
      mgr.clearDismissed();
      expect(fn).toHaveBeenCalledTimes(1);
    });
  });

  // -------------------------------------------------------------------------
  // Subscribe / unsubscribe
  // -------------------------------------------------------------------------

  describe('subscribe / unsubscribe', () => {
    it('subscribe returns unsubscribe function', () => {
      const mgr = freshManager();
      const fn = vi.fn();
      const unsub = mgr.subscribe(fn);
      mgr.toggle();
      expect(fn).toHaveBeenCalledTimes(1);
      unsub();
      mgr.toggle();
      expect(fn).toHaveBeenCalledTimes(1); // not called again
    });

    it('supports multiple subscribers', () => {
      const mgr = freshManager();
      const fn1 = vi.fn();
      const fn2 = vi.fn();
      mgr.subscribe(fn1);
      mgr.subscribe(fn2);
      mgr.toggle();
      expect(fn1).toHaveBeenCalledTimes(1);
      expect(fn2).toHaveBeenCalledTimes(1);
    });

    it('handles unsubscribe during notification gracefully', () => {
      const mgr = freshManager();
      const fn1 = vi.fn();
      const fn2 = vi.fn();
      const unsub = mgr.subscribe(fn1);
      mgr.subscribe(() => { unsub(); fn2(); });
      // Should not throw
      expect(() => { mgr.toggle(); }).not.toThrow();
    });
  });

  // -------------------------------------------------------------------------
  // Persistence
  // -------------------------------------------------------------------------

  describe('persistence', () => {
    it('persists enabled state to localStorage', () => {
      const mgr = freshManager();
      mgr.setEnabled(false);
      expect(localStorage.getItem('protopulse-ai-safety-mode')).toBe('false');
    });

    it('restores enabled state from localStorage', () => {
      localStorage.setItem('protopulse-ai-safety-mode', 'false');
      AISafetyModeManager.resetInstance();
      const mgr = AISafetyModeManager.getInstance();
      expect(mgr.enabled).toBe(false);
    });

    it('persists dismissed actions to localStorage', () => {
      const mgr = freshManager();
      mgr.dismissAction('remove_node');
      mgr.dismissAction('clear_canvas');
      const raw = localStorage.getItem('protopulse-ai-safety-dismissed');
      expect(raw).toBeTruthy();
      const parsed = JSON.parse(raw!) as string[];
      expect(parsed).toContain('remove_node');
      expect(parsed).toContain('clear_canvas');
    });

    it('restores dismissed actions from localStorage', () => {
      localStorage.setItem('protopulse-ai-safety-dismissed', JSON.stringify(['remove_node', 'clear_canvas']));
      AISafetyModeManager.resetInstance();
      const mgr = AISafetyModeManager.getInstance();
      expect(mgr.isDismissed('remove_node')).toBe(true);
      expect(mgr.isDismissed('clear_canvas')).toBe(true);
      expect(mgr.isDismissed('generate_architecture')).toBe(false);
    });

    it('handles corrupted localStorage gracefully', () => {
      localStorage.setItem('protopulse-ai-safety-mode', 'garbage');
      localStorage.setItem('protopulse-ai-safety-dismissed', 'not-json');
      AISafetyModeManager.resetInstance();
      const mgr = AISafetyModeManager.getInstance();
      // Should not throw, uses defaults
      expect(mgr.enabled).toBe(false); // 'garbage' !== 'true'
      expect(mgr.dismissedActions.size).toBe(0);
    });

    it('handles missing localStorage gracefully', () => {
      AISafetyModeManager.resetInstance();
      const mgr = AISafetyModeManager.getInstance();
      expect(mgr.enabled).toBe(true); // default
    });
  });

  // -------------------------------------------------------------------------
  // Edge cases
  // -------------------------------------------------------------------------

  describe('edge cases', () => {
    it('classifyAction handles undefined-like input', () => {
      const mgr = freshManager();
      expect(mgr.classifyAction('')).toBe('safe');
    });

    it('dismissing an already-dismissed action is idempotent', () => {
      const mgr = freshManager();
      mgr.dismissAction('remove_node');
      mgr.dismissAction('remove_node');
      expect(mgr.isDismissed('remove_node')).toBe(true);
      expect(mgr.dismissedActions.size).toBe(1);
    });

    it('undismissing a non-dismissed action is a no-op', () => {
      const mgr = freshManager();
      const fn = vi.fn();
      mgr.subscribe(fn);
      mgr.undismissAction('never_dismissed');
      // Still notifies (Set.delete returns false but we still call notify for consistency)
      expect(mgr.isDismissed('never_dismissed')).toBe(false);
    });

    it('getTeachingExplanation returns string for every known action', () => {
      const mgr = freshManager();
      const allKnown = [
        'remove_node', 'delete_node', 'remove_edge', 'delete_edge',
        'clear_canvas', 'clear_architecture', 'clear_validation',
        'remove_bom_item', 'replace_bom', 'delete_component',
        'generate_architecture', 'add_multiple_nodes', 'modify_component',
        'update_node', 'connect_nodes', 'auto_layout', 'auto_fix_validation',
        'add_subcircuit', 'auto_assign_pins', 'optimize_bom',
        'rename_project', 'update_description', 'set_project_type', 'import_design',
      ];
      for (const action of allKnown) {
        const explanation = mgr.getTeachingExplanation(action);
        expect(typeof explanation).toBe('string');
        expect(explanation.length).toBeGreaterThan(10);
      }
    });

    it('classification types are exhaustive', () => {
      const mgr = freshManager();
      const allClassifications = new Set<SafetyClassification>();
      allClassifications.add(mgr.classifyAction('remove_node')); // destructive
      allClassifications.add(mgr.classifyAction('generate_architecture')); // caution
      allClassifications.add(mgr.classifyAction('switch_view')); // safe
      expect(allClassifications.size).toBe(3);
      expect(allClassifications).toContain('safe');
      expect(allClassifications).toContain('caution');
      expect(allClassifications).toContain('destructive');
    });
  });
});

// ---------------------------------------------------------------------------
// useAISafetyMode hook
// ---------------------------------------------------------------------------

describe('useAISafetyMode', () => {
  beforeEach(() => {
    AISafetyModeManager.resetInstance();
    localStorage.clear();
  });

  afterEach(() => {
    AISafetyModeManager.resetInstance();
  });

  it('returns enabled as true by default', () => {
    const { result } = renderHook(() => useAISafetyMode());
    expect(result.current.enabled).toBe(true);
  });

  it('toggle changes enabled state', () => {
    const { result } = renderHook(() => useAISafetyMode());
    act(() => { result.current.toggle(); });
    expect(result.current.enabled).toBe(false);
    act(() => { result.current.toggle(); });
    expect(result.current.enabled).toBe(true);
  });

  it('setEnabled changes enabled state', () => {
    const { result } = renderHook(() => useAISafetyMode());
    act(() => { result.current.setEnabled(false); });
    expect(result.current.enabled).toBe(false);
  });

  it('classifyAction works from hook', () => {
    const { result } = renderHook(() => useAISafetyMode());
    expect(result.current.classifyAction('remove_node')).toBe('destructive');
    expect(result.current.classifyAction('generate_architecture')).toBe('caution');
    expect(result.current.classifyAction('switch_view')).toBe('safe');
  });

  it('getTeachingExplanation returns explanation from hook', () => {
    const { result } = renderHook(() => useAISafetyMode());
    expect(result.current.getTeachingExplanation('clear_canvas')).toContain('remove ALL');
  });

  it('getSafetyInfo returns full info from hook', () => {
    const { result } = renderHook(() => useAISafetyMode());
    const info = result.current.getSafetyInfo('remove_node');
    expect(info.classification).toBe('destructive');
    expect(info.explanation).toBeTruthy();
    expect(info.consequences.length).toBeGreaterThan(0);
  });

  it('needsConfirmation works from hook', () => {
    const { result } = renderHook(() => useAISafetyMode());
    expect(result.current.needsConfirmation('remove_node')).toBe(true);
    expect(result.current.needsConfirmation('switch_view')).toBe(false);
  });

  it('dismissAction and isDismissed work from hook', () => {
    const { result } = renderHook(() => useAISafetyMode());
    act(() => { result.current.dismissAction('remove_node'); });
    expect(result.current.isDismissed('remove_node')).toBe(true);
    expect(result.current.needsConfirmation('remove_node')).toBe(false);
  });

  it('undismissAction works from hook', () => {
    const { result } = renderHook(() => useAISafetyMode());
    act(() => { result.current.dismissAction('remove_node'); });
    expect(result.current.isDismissed('remove_node')).toBe(true);
    act(() => { result.current.undismissAction('remove_node'); });
    expect(result.current.isDismissed('remove_node')).toBe(false);
  });

  it('clearDismissed works from hook', () => {
    const { result } = renderHook(() => useAISafetyMode());
    act(() => { result.current.dismissAction('remove_node'); });
    act(() => { result.current.dismissAction('clear_canvas'); });
    expect(result.current.isDismissed('remove_node')).toBe(true);
    act(() => { result.current.clearDismissed(); });
    expect(result.current.isDismissed('remove_node')).toBe(false);
    expect(result.current.isDismissed('clear_canvas')).toBe(false);
  });
});
