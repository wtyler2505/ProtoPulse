/**
 * Canvas Screen Reader Tests
 *
 * Integration tests for canvas-accessibility.ts and use-canvas-announcer.ts —
 * verifies screen-reader announcements in realistic EDA workflows, hook
 * lifecycle, rapid-fire announcement handling, and aria-live region behavior.
 *
 * BL-0326: Screen-reader labels for canvas actions
 *
 * Runs in client project config (happy-dom environment).
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import {
  getAriaLabel,
  getActionAnnouncement,
  getToolChangeAnnouncement,
  getCanvasAriaLabel,
  getToolButtonAriaLabel,
  getZoomAnnouncement,
  getWireAriaLabel,
  CanvasAnnouncer,
} from '../canvas-accessibility';
import type {
  CanvasView,
  CanvasEntityType,
  CanvasAction,
  CanvasTool,
} from '../canvas-accessibility';
import { useCanvasAnnouncer } from '../use-canvas-announcer';

// ---------------------------------------------------------------------------
// useCanvasAnnouncer hook tests
// ---------------------------------------------------------------------------

describe('useCanvasAnnouncer', () => {
  afterEach(() => {
    // Ensure no leaked live regions
    const regions = document.querySelectorAll('[data-testid="canvas-announcer"]');
    regions.forEach((r) => { r.remove(); });
  });

  it('should create a live region on mount', () => {
    const { unmount } = renderHook(() => useCanvasAnnouncer());
    const region = document.querySelector('[data-testid="canvas-announcer"]');
    expect(region).not.toBeNull();
    expect(region?.getAttribute('aria-live')).toBe('polite');
    unmount();
  });

  it('should remove the live region on unmount', () => {
    const { unmount } = renderHook(() => useCanvasAnnouncer());
    expect(document.querySelector('[data-testid="canvas-announcer"]')).not.toBeNull();
    unmount();
    expect(document.querySelector('[data-testid="canvas-announcer"]')).toBeNull();
  });

  it('should return a stable announce function across re-renders', () => {
    const { result, rerender } = renderHook(() => useCanvasAnnouncer());
    const firstAnnounce = result.current;
    rerender();
    const secondAnnounce = result.current;
    expect(firstAnnounce).toBe(secondAnnounce);
    // Clean up
    const { unmount } = renderHook(() => useCanvasAnnouncer());
    unmount();
  });

  it('should set message on the live region via announce', async () => {
    const { result, unmount } = renderHook(() => useCanvasAnnouncer());
    act(() => {
      result.current('Added Component U1');
    });
    await new Promise((resolve) => { requestAnimationFrame(resolve); });
    const region = document.querySelector('[data-testid="canvas-announcer"]');
    expect(region?.textContent).toBe('Added Component U1');
    unmount();
  });

  it('should not throw if announce is called after unmount', () => {
    const { result, unmount } = renderHook(() => useCanvasAnnouncer());
    const announce = result.current;
    unmount();
    expect(() => { announce('Post-unmount message'); }).not.toThrow();
  });

  it('should not leave orphan live regions after multiple mount/unmount cycles', () => {
    for (let i = 0; i < 5; i++) {
      const { unmount } = renderHook(() => useCanvasAnnouncer());
      unmount();
    }
    const regions = document.querySelectorAll('[data-testid="canvas-announcer"]');
    expect(regions.length).toBe(0);
  });
});

// ---------------------------------------------------------------------------
// CanvasAnnouncer — advanced behavior
// ---------------------------------------------------------------------------

describe('CanvasAnnouncer advanced', () => {
  let announcer: CanvasAnnouncer;

  beforeEach(() => {
    vi.useFakeTimers();
    announcer = new CanvasAnnouncer();
  });

  afterEach(() => {
    announcer.destroy();
    vi.useRealTimers();
  });

  it('should clear previous timer when a new announce overwrites it', () => {
    announcer.announce('First');
    // Advance 500ms — within the 1s window
    vi.advanceTimersByTime(500);
    // Second announcement resets the timer
    announcer.announce('Second');
    // Advance another 500ms — would have cleared "First" but timer was reset
    vi.advanceTimersByTime(500);
    // The second message's timer hasn't fired yet (only 500ms of its 1s)
    // We need to trigger rAF for the second message to appear
    // With fake timers, rAF fires synchronously on next timer tick
    vi.advanceTimersByTime(0);
    // The message should still be present (timer hasn't expired for "Second")
    // Wait 500ms more to expire the second timer
    vi.advanceTimersByTime(500);
    expect(announcer.getCurrentMessage()).toBe('');
  });

  it('should handle empty string announcements', () => {
    announcer.announce('');
    vi.advanceTimersByTime(0);
    // Empty string is a valid textContent
    expect(announcer.getCurrentMessage()).toBe('');
  });

  it('should handle very long announcements', () => {
    const longMessage = 'A'.repeat(5000);
    announcer.announce(longMessage);
    // Should not throw
    expect(announcer.getCurrentMessage()).not.toBeUndefined();
  });

  it('should handle special characters in announcements', async () => {
    vi.useRealTimers();
    announcer.announce('Component "R1" — 10k\u2126 \u00b10.1%');
    await new Promise((resolve) => { requestAnimationFrame(resolve); });
    expect(announcer.getCurrentMessage()).toBe('Component "R1" — 10k\u2126 \u00b10.1%');
  });

  it('should clean up timer on destroy even when announce is pending', () => {
    announcer.announce('Pending');
    // Destroy while timer is still running
    announcer.destroy();
    // Advancing time should not cause errors
    vi.advanceTimersByTime(2000);
    expect(announcer.getCurrentMessage()).toBe('');
  });

  it('should support rapid-fire announcements keeping only the last', async () => {
    vi.useRealTimers();
    announcer.announce('One');
    announcer.announce('Two');
    announcer.announce('Three');
    announcer.announce('Four');
    announcer.announce('Five');
    await new Promise((resolve) => { requestAnimationFrame(resolve); });
    // Only the last message should be visible (rAF coalesces)
    expect(announcer.getCurrentMessage()).toBe('Five');
  });

  it('should have the correct ARIA attributes on the live region', () => {
    const region = document.querySelector('[data-testid="canvas-announcer"]') as HTMLElement;
    expect(region.getAttribute('role')).toBe('status');
    expect(region.getAttribute('aria-live')).toBe('polite');
    expect(region.getAttribute('aria-atomic')).toBe('true');
  });
});

// ---------------------------------------------------------------------------
// Realistic EDA workflow sequences
// ---------------------------------------------------------------------------

describe('Screen reader workflow: placing a component', () => {
  it('should produce correct sequence for placing and connecting', () => {
    const steps = [
      getToolChangeAnnouncement('component', 'schematic'),
      getActionAnnouncement({ action: 'add', entityType: 'component', label: 'R1', detail: '10k resistor' }),
      getToolChangeAnnouncement('wire', 'schematic'),
      getActionAnnouncement({ action: 'start-wire', view: 'schematic' }),
      getActionAnnouncement({ action: 'finish-wire' }),
      getActionAnnouncement({ action: 'connect', entityType: 'wire', label: 'VCC' }),
    ];

    expect(steps[0]).toBe('Switched tool to Place component on Schematic');
    expect(steps[1]).toBe('Added Component R1 10k resistor');
    expect(steps[2]).toBe('Switched tool to Wire drawing on Schematic');
    expect(steps[3]).toBe('Started drawing wire on Schematic');
    expect(steps[4]).toBe('Finished wire');
    expect(steps[5]).toBe('Connected Wire VCC');
  });
});

describe('Screen reader workflow: PCB editing', () => {
  it('should produce correct sequence for PCB trace routing', () => {
    const steps = [
      getCanvasAriaLabel('pcb', 'Motor Driver Board'),
      getToolChangeAnnouncement('trace', 'pcb'),
      getActionAnnouncement({ action: 'select', entityType: 'component', label: 'U1' }),
      getActionAnnouncement({ action: 'rotate', entityType: 'component', label: 'U1' }),
      getToolChangeAnnouncement('via', 'pcb'),
      getActionAnnouncement({ action: 'add', entityType: 'via', detail: 'layer change F.Cu to B.Cu' }),
      getZoomAnnouncement(2.0, 'zoom-in'),
    ];

    expect(steps[0]).toBe('PCB layout canvas for Motor Driver Board. Use keyboard shortcuts for navigation.');
    expect(steps[1]).toBe('Switched tool to Trace routing on PCB layout');
    expect(steps[2]).toBe('Selected Component U1');
    expect(steps[3]).toBe('Rotated Component U1');
    expect(steps[4]).toBe('Switched tool to Place via on PCB layout');
    expect(steps[5]).toBe('Added via layer change F.Cu to B.Cu');
    expect(steps[6]).toBe('Zoomed in to 2.0x');
  });
});

describe('Screen reader workflow: undo/redo sequence', () => {
  it('should produce correct undo/redo announcements', () => {
    const addAnnounce = getActionAnnouncement({ action: 'add', entityType: 'component', label: 'C1' });
    const undoAnnounce = getActionAnnouncement({ action: 'undo' });
    const redoAnnounce = getActionAnnouncement({ action: 'redo' });

    expect(addAnnounce).toBe('Added Component C1');
    expect(undoAnnounce).toBe('Undo');
    expect(redoAnnounce).toBe('Redo');
  });
});

describe('Screen reader workflow: copy/paste', () => {
  it('should announce copy and paste with entity details', () => {
    const copyAnnounce = getActionAnnouncement({ action: 'copy', entityType: 'component', label: 'R1' });
    const pasteAnnounce = getActionAnnouncement({ action: 'paste', entityType: 'component', label: 'R2' });

    expect(copyAnnounce).toBe('Copied Component R1');
    expect(pasteAnnounce).toBe('Pasted Component R2');
  });
});

// ---------------------------------------------------------------------------
// Cross-function integration
// ---------------------------------------------------------------------------

describe('getAriaLabel + getActionAnnouncement consistency', () => {
  it('should use the same entity labels across functions', () => {
    const entityTypes: CanvasEntityType[] = [
      'component', 'wire', 'net', 'via', 'zone', 'trace',
      'power-symbol', 'net-label', 'annotation', 'comment', 'no-connect',
    ];
    for (const entityType of entityTypes) {
      const ariaLabel = getAriaLabel({ entityType, label: 'X1' });
      const announcement = getActionAnnouncement({ action: 'select', entityType, label: 'X1' });
      // Both should reference the entity type's human-readable name
      // ariaLabel format: "Type, X1"
      // announcement format: "Selected Type X1"
      const typeName = ariaLabel.split(',')[0];
      expect(announcement).toContain(typeName);
    }
  });
});

describe('getToolChangeAnnouncement + getToolButtonAriaLabel consistency', () => {
  it('should reference the same tool labels', () => {
    const tools: CanvasTool[] = [
      'select', 'wire', 'trace', 'delete', 'pan', 'draw-net',
      'place-power', 'place-net-label', 'place-annotation', 'place-no-connect',
      'via', 'zone', 'comment', 'component',
    ];
    for (const tool of tools) {
      const changeAnn = getToolChangeAnnouncement(tool);
      const buttonLabel = getToolButtonAriaLabel(tool, false);
      // Extract tool name from "Switched tool to <name>"
      const toolNameFromChange = changeAnn.replace('Switched tool to ', '').trim();
      // Extract tool name from "<name> tool"
      const toolNameFromButton = buttonLabel.replace(' tool', '').trim();
      expect(toolNameFromChange).toBe(toolNameFromButton);
    }
  });
});

// ---------------------------------------------------------------------------
// Breadboard-specific scenarios
// ---------------------------------------------------------------------------

describe('Screen reader: breadboard view specifics', () => {
  it('should label breadboard canvas correctly', () => {
    const label = getCanvasAriaLabel('breadboard');
    expect(label).toContain('Breadboard');
    expect(label).toContain('keyboard shortcuts');
  });

  it('should include breadboard in wire aria label', () => {
    const wireLabel = getWireAriaLabel({ netName: 'SDA', pointCount: 3, view: 'breadboard' });
    expect(wireLabel).toContain('Breadboard');
    expect(wireLabel).toContain('SDA');
    expect(wireLabel).toContain('3 points');
  });

  it('should produce correct tool change for breadboard wire drawing', () => {
    const ann = getToolChangeAnnouncement('wire', 'breadboard');
    expect(ann).toBe('Switched tool to Wire drawing on Breadboard');
  });
});

// ---------------------------------------------------------------------------
// Edge cases in label generation
// ---------------------------------------------------------------------------

describe('Label generation edge cases', () => {
  it('should handle label with special characters', () => {
    const result = getAriaLabel({ entityType: 'component', label: 'IC_3.3V' });
    expect(result).toBe('Component, IC_3.3V');
  });

  it('should handle detail with unicode', () => {
    const result = getAriaLabel({ entityType: 'component', label: 'R1', detail: '100\u03A9 \u00b11%' });
    expect(result).toContain('100\u03A9');
  });

  it('should handle negative position coordinates', () => {
    const result = getAriaLabel({ entityType: 'via', position: { x: -10, y: -20 } });
    expect(result).toBe('Via, at position -10, -20');
  });

  it('should handle zero position coordinates', () => {
    const result = getAriaLabel({ entityType: 'trace', position: { x: 0, y: 0 } });
    expect(result).toBe('Trace, at position 0, 0');
  });

  it('should handle very large position coordinates', () => {
    const result = getAriaLabel({ entityType: 'component', position: { x: 99999.999, y: -88888.001 } });
    expect(result).toBe('Component, at position 100000, -88888');
  });

  it('should handle wire with zero points', () => {
    const result = getWireAriaLabel({ pointCount: 0 });
    expect(result).toBe('Wire, with 0 points');
  });

  it('should handle wire with one point (in-progress drawing)', () => {
    const result = getWireAriaLabel({ pointCount: 1, view: 'schematic' });
    expect(result).toBe('Wire, with 1 points, on Schematic');
  });

  it('should handle zoom at boundary values', () => {
    expect(getZoomAnnouncement(0.1, 'zoom-out')).toBe('Zoomed out to 0.1x');
    expect(getZoomAnnouncement(10.0, 'zoom-in')).toBe('Zoomed in to 10.0x');
    expect(getZoomAnnouncement(1.0, 'zoom-reset')).toBe('Zoom reset to 1.0x');
  });

  it('should handle zoom with many decimals', () => {
    expect(getZoomAnnouncement(1.23456, 'zoom-in')).toBe('Zoomed in to 1.2x');
  });
});

// ---------------------------------------------------------------------------
// Toolbar button label variations
// ---------------------------------------------------------------------------

describe('getToolButtonAriaLabel edge cases', () => {
  it('should handle compound shortcut strings', () => {
    const result = getToolButtonAriaLabel('select', false, 'Ctrl+Shift+A');
    expect(result).toBe('Select tool. Shortcut: Ctrl+Shift+A');
  });

  it('should handle empty shortcut string', () => {
    const result = getToolButtonAriaLabel('wire', true, '');
    // Empty string is falsy, so no shortcut appended
    expect(result).toBe('Wire drawing tool, active');
  });

  it('should handle all tools as inactive without shortcut', () => {
    const tools: CanvasTool[] = [
      'select', 'wire', 'trace', 'delete', 'pan', 'draw-net',
      'place-power', 'place-net-label', 'place-annotation', 'place-no-connect',
      'via', 'zone', 'comment', 'component',
    ];
    for (const tool of tools) {
      const label = getToolButtonAriaLabel(tool, false);
      expect(label).toMatch(/^.+ tool$/);
      expect(label).not.toContain('active');
      expect(label).not.toContain('Shortcut');
    }
  });
});

// ---------------------------------------------------------------------------
// Action announcements for layer toggle
// ---------------------------------------------------------------------------

describe('Layer and tool-change announcements', () => {
  it('should announce layer toggle', () => {
    const result = getActionAnnouncement({ action: 'toggle-layer', detail: 'F.Cu' });
    expect(result).toBe('Toggled layer F.Cu');
  });

  it('should announce tool change action (generic)', () => {
    const result = getActionAnnouncement({ action: 'tool-change', detail: 'Trace routing' });
    expect(result).toBe('Switched tool Trace routing');
  });

  it('should announce cancel action', () => {
    const result = getActionAnnouncement({ action: 'cancel', view: 'pcb' });
    expect(result).toBe('Cancelled on PCB layout');
  });

  it('should announce disconnect', () => {
    const result = getActionAnnouncement({ action: 'disconnect', entityType: 'wire', label: 'CLK' });
    expect(result).toBe('Disconnected Wire CLK');
  });

  it('should announce rename', () => {
    const result = getActionAnnouncement({ action: 'rename', entityType: 'net-label', label: 'SDA' });
    expect(result).toBe('Renamed Net label SDA');
  });

  it('should announce deselect', () => {
    const result = getActionAnnouncement({ action: 'deselect', entityType: 'component', label: 'Q1' });
    expect(result).toBe('Deselected Component Q1');
  });

  it('should announce move', () => {
    const result = getActionAnnouncement({ action: 'move', entityType: 'component', label: 'U2' });
    expect(result).toBe('Moved Component U2');
  });
});

// ---------------------------------------------------------------------------
// Integration: CanvasAnnouncer with getActionAnnouncement
// ---------------------------------------------------------------------------

describe('CanvasAnnouncer + getActionAnnouncement integration', () => {
  let announcer: CanvasAnnouncer;

  beforeEach(() => {
    announcer = new CanvasAnnouncer();
  });

  afterEach(() => {
    announcer.destroy();
  });

  it('should announce a generated action message to the live region', async () => {
    const message = getActionAnnouncement({ action: 'select', entityType: 'component', label: 'R1' });
    announcer.announce(message);
    await new Promise((resolve) => { requestAnimationFrame(resolve); });
    expect(announcer.getCurrentMessage()).toBe('Selected Component R1');
  });

  it('should announce a generated tool change to the live region', async () => {
    const message = getToolChangeAnnouncement('trace', 'pcb');
    announcer.announce(message);
    await new Promise((resolve) => { requestAnimationFrame(resolve); });
    expect(announcer.getCurrentMessage()).toBe('Switched tool to Trace routing on PCB layout');
  });

  it('should announce a zoom message to the live region', async () => {
    const message = getZoomAnnouncement(1.5, 'zoom-in');
    announcer.announce(message);
    await new Promise((resolve) => { requestAnimationFrame(resolve); });
    expect(announcer.getCurrentMessage()).toBe('Zoomed in to 1.5x');
  });
});
