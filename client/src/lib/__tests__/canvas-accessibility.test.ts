/**
 * Canvas Accessibility Tests
 *
 * Tests for client/src/lib/canvas-accessibility.ts — aria-label generators,
 * action announcements, and the CanvasAnnouncer live region manager.
 *
 * BL-0326: Screen-reader labels for canvas actions
 *
 * Runs in client project config (happy-dom environment).
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
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
  AriaLabelOptions,
  AnnouncementOptions,
} from '../canvas-accessibility';

// ---------------------------------------------------------------------------
// getAriaLabel
// ---------------------------------------------------------------------------

describe('getAriaLabel', () => {
  it('should return entity type alone when no other options given', () => {
    const result = getAriaLabel({ entityType: 'component' });
    expect(result).toBe('Component');
  });

  it('should include the label when provided', () => {
    const result = getAriaLabel({ entityType: 'component', label: 'R1' });
    expect(result).toBe('Component, R1');
  });

  it('should include detail when provided', () => {
    const result = getAriaLabel({ entityType: 'component', label: 'R1', detail: '100 ohm resistor' });
    expect(result).toBe('Component, R1, 100 ohm resistor');
  });

  it('should include position when provided', () => {
    const result = getAriaLabel({ entityType: 'via', position: { x: 50.3, y: 60.7 } });
    expect(result).toBe('Via, at position 50, 61');
  });

  it('should include view context when provided', () => {
    const result = getAriaLabel({ entityType: 'wire', view: 'schematic' });
    expect(result).toBe('Wire, on Schematic');
  });

  it('should include selected state', () => {
    const result = getAriaLabel({ entityType: 'component', label: 'U1', selected: true });
    expect(result).toBe('Component, U1, selected');
  });

  it('should combine all options', () => {
    const result = getAriaLabel({
      entityType: 'component',
      label: 'R1',
      detail: '10k resistor',
      position: { x: 100, y: 200 },
      view: 'pcb',
      selected: true,
    });
    expect(result).toBe('Component, R1, 10k resistor, at position 100, 200, on PCB layout, selected');
  });

  it('should not append selected when false', () => {
    const result = getAriaLabel({ entityType: 'net', label: 'GND', selected: false });
    expect(result).toBe('Net, GND');
  });

  it('should handle all entity types', () => {
    const types: CanvasEntityType[] = [
      'component', 'wire', 'net', 'via', 'zone', 'trace',
      'power-symbol', 'net-label', 'annotation', 'comment', 'no-connect',
    ];
    for (const entityType of types) {
      const result = getAriaLabel({ entityType });
      expect(result.length).toBeGreaterThan(0);
    }
  });

  it('should handle all view types', () => {
    const views: CanvasView[] = ['schematic', 'breadboard', 'pcb'];
    for (const view of views) {
      const result = getAriaLabel({ entityType: 'component', view });
      expect(result).toContain('on');
    }
  });

  it('should handle power-symbol entity type correctly', () => {
    const result = getAriaLabel({ entityType: 'power-symbol', label: 'VCC' });
    expect(result).toBe('Power symbol, VCC');
  });

  it('should handle net-label entity type correctly', () => {
    const result = getAriaLabel({ entityType: 'net-label', label: 'SDA' });
    expect(result).toBe('Net label, SDA');
  });

  it('should handle no-connect entity type correctly', () => {
    const result = getAriaLabel({ entityType: 'no-connect', position: { x: 10, y: 20 } });
    expect(result).toBe('No-connect marker, at position 10, 20');
  });

  it('should round position coordinates', () => {
    const result = getAriaLabel({ entityType: 'via', position: { x: 12.999, y: 0.001 } });
    expect(result).toBe('Via, at position 13, 0');
  });
});

// ---------------------------------------------------------------------------
// getActionAnnouncement
// ---------------------------------------------------------------------------

describe('getActionAnnouncement', () => {
  it('should return action verb for entity-less actions', () => {
    const result = getActionAnnouncement({ action: 'zoom-in' });
    expect(result).toBe('Zoomed in');
  });

  it('should include entity type and label', () => {
    const result = getActionAnnouncement({ action: 'select', entityType: 'component', label: 'R1' });
    expect(result).toBe('Selected Component R1');
  });

  it('should lowercase entity type when no label given', () => {
    const result = getActionAnnouncement({ action: 'delete', entityType: 'wire' });
    expect(result).toBe('Deleted wire');
  });

  it('should include detail', () => {
    const result = getActionAnnouncement({ action: 'add', entityType: 'component', label: 'C1', detail: '100nF capacitor' });
    expect(result).toBe('Added Component C1 100nF capacitor');
  });

  it('should include view context for entity-less actions', () => {
    const result = getActionAnnouncement({ action: 'start-wire', view: 'breadboard' });
    expect(result).toBe('Started drawing wire on Breadboard');
  });

  it('should not include view context when entity is provided', () => {
    const result = getActionAnnouncement({ action: 'select', entityType: 'component', label: 'U1', view: 'schematic' });
    expect(result).toBe('Selected Component U1');
  });

  it('should handle all action types', () => {
    const actions: CanvasAction[] = [
      'select', 'deselect', 'move', 'rotate', 'delete', 'add',
      'connect', 'disconnect', 'start-wire', 'finish-wire', 'cancel',
      'copy', 'paste', 'rename', 'zoom-in', 'zoom-out', 'zoom-reset',
      'undo', 'redo', 'toggle-layer', 'tool-change',
    ];
    for (const action of actions) {
      const result = getActionAnnouncement({ action });
      expect(result.length).toBeGreaterThan(0);
    }
  });

  it('should produce correct announcement for start-wire', () => {
    const result = getActionAnnouncement({ action: 'start-wire', entityType: 'wire', label: 'GND' });
    expect(result).toBe('Started drawing wire Wire GND');
  });

  it('should produce correct announcement for finish-wire', () => {
    const result = getActionAnnouncement({ action: 'finish-wire' });
    expect(result).toBe('Finished wire');
  });
});

// ---------------------------------------------------------------------------
// getToolChangeAnnouncement
// ---------------------------------------------------------------------------

describe('getToolChangeAnnouncement', () => {
  it('should generate tool change announcement without view', () => {
    const result = getToolChangeAnnouncement('select');
    expect(result).toBe('Switched tool to Select');
  });

  it('should generate tool change announcement with view', () => {
    const result = getToolChangeAnnouncement('trace', 'pcb');
    expect(result).toBe('Switched tool to Trace routing on PCB layout');
  });

  it('should handle all tool types', () => {
    const tools: CanvasTool[] = [
      'select', 'wire', 'trace', 'delete', 'pan', 'draw-net',
      'place-power', 'place-net-label', 'place-annotation', 'place-no-connect',
      'via', 'zone', 'comment', 'component',
    ];
    for (const tool of tools) {
      const result = getToolChangeAnnouncement(tool);
      expect(result).toContain('Switched tool to');
    }
  });

  it('should produce correct labels for complex tool names', () => {
    expect(getToolChangeAnnouncement('place-power')).toBe('Switched tool to Place power symbol');
    expect(getToolChangeAnnouncement('place-no-connect')).toBe('Switched tool to Place no-connect marker');
    expect(getToolChangeAnnouncement('draw-net')).toBe('Switched tool to Draw net');
  });
});

// ---------------------------------------------------------------------------
// getCanvasAriaLabel
// ---------------------------------------------------------------------------

describe('getCanvasAriaLabel', () => {
  it('should return label without circuit name', () => {
    const result = getCanvasAriaLabel('schematic');
    expect(result).toBe('Schematic canvas. Use keyboard shortcuts for navigation.');
  });

  it('should return label with circuit name', () => {
    const result = getCanvasAriaLabel('pcb', 'Main Circuit');
    expect(result).toBe('PCB layout canvas for Main Circuit. Use keyboard shortcuts for navigation.');
  });

  it('should handle breadboard view', () => {
    const result = getCanvasAriaLabel('breadboard', 'Power Supply');
    expect(result).toBe('Breadboard canvas for Power Supply. Use keyboard shortcuts for navigation.');
  });

  it('should handle all view types', () => {
    const views: CanvasView[] = ['schematic', 'breadboard', 'pcb'];
    for (const view of views) {
      const result = getCanvasAriaLabel(view);
      expect(result).toContain('canvas');
      expect(result).toContain('keyboard shortcuts');
    }
  });
});

// ---------------------------------------------------------------------------
// getToolButtonAriaLabel
// ---------------------------------------------------------------------------

describe('getToolButtonAriaLabel', () => {
  it('should return label for inactive tool without shortcut', () => {
    const result = getToolButtonAriaLabel('select', false);
    expect(result).toBe('Select tool');
  });

  it('should include active state', () => {
    const result = getToolButtonAriaLabel('wire', true);
    expect(result).toBe('Wire drawing tool, active');
  });

  it('should include shortcut', () => {
    const result = getToolButtonAriaLabel('select', false, '1');
    expect(result).toBe('Select tool. Shortcut: 1');
  });

  it('should combine active and shortcut', () => {
    const result = getToolButtonAriaLabel('delete', true, '3');
    expect(result).toBe('Delete tool, active. Shortcut: 3');
  });
});

// ---------------------------------------------------------------------------
// getZoomAnnouncement
// ---------------------------------------------------------------------------

describe('getZoomAnnouncement', () => {
  it('should announce zoom in', () => {
    const result = getZoomAnnouncement(2.5, 'zoom-in');
    expect(result).toBe('Zoomed in to 2.5x');
  });

  it('should announce zoom out', () => {
    const result = getZoomAnnouncement(1.0, 'zoom-out');
    expect(result).toBe('Zoomed out to 1.0x');
  });

  it('should announce zoom reset', () => {
    const result = getZoomAnnouncement(3.0, 'zoom-reset');
    expect(result).toBe('Zoom reset to 3.0x');
  });

  it('should format zoom level with one decimal', () => {
    const result = getZoomAnnouncement(1, 'zoom-in');
    expect(result).toBe('Zoomed in to 1.0x');
  });
});

// ---------------------------------------------------------------------------
// getWireAriaLabel
// ---------------------------------------------------------------------------

describe('getWireAriaLabel', () => {
  it('should return basic wire label', () => {
    const result = getWireAriaLabel({ pointCount: 3 });
    expect(result).toBe('Wire, with 3 points');
  });

  it('should include net name', () => {
    const result = getWireAriaLabel({ netName: 'VCC', pointCount: 2 });
    expect(result).toBe('Wire, on net VCC, with 2 points');
  });

  it('should include view context', () => {
    const result = getWireAriaLabel({ pointCount: 4, view: 'breadboard' });
    expect(result).toBe('Wire, with 4 points, on Breadboard');
  });

  it('should include selected state', () => {
    const result = getWireAriaLabel({ netName: 'GND', pointCount: 2, selected: true });
    expect(result).toBe('Wire, on net GND, with 2 points, selected');
  });

  it('should combine all options', () => {
    const result = getWireAriaLabel({ netName: 'CLK', pointCount: 5, view: 'pcb', selected: true });
    expect(result).toBe('Wire, on net CLK, with 5 points, on PCB layout, selected');
  });
});

// ---------------------------------------------------------------------------
// CanvasAnnouncer
// ---------------------------------------------------------------------------

describe('CanvasAnnouncer', () => {
  let announcer: CanvasAnnouncer;

  beforeEach(() => {
    announcer = new CanvasAnnouncer();
  });

  afterEach(() => {
    announcer.destroy();
  });

  it('should create a live region in the DOM', () => {
    const liveRegion = document.querySelector('[data-testid="canvas-announcer"]');
    expect(liveRegion).not.toBeNull();
    expect(liveRegion?.getAttribute('role')).toBe('status');
    expect(liveRegion?.getAttribute('aria-live')).toBe('polite');
    expect(liveRegion?.getAttribute('aria-atomic')).toBe('true');
  });

  it('should be visually hidden', () => {
    const liveRegion = document.querySelector('[data-testid="canvas-announcer"]') as HTMLElement;
    expect(liveRegion).not.toBeNull();
    expect(liveRegion.style.position).toBe('absolute');
    expect(liveRegion.style.width).toBe('1px');
    expect(liveRegion.style.height).toBe('1px');
    expect(liveRegion.style.overflow).toBe('hidden');
  });

  it('should announce a message', async () => {
    announcer.announce('Selected Component R1');
    // Wait for requestAnimationFrame
    await new Promise((resolve) => { requestAnimationFrame(resolve); });
    const liveRegion = document.querySelector('[data-testid="canvas-announcer"]');
    expect(liveRegion?.textContent).toBe('Selected Component R1');
  });

  it('should clear the message after timeout', async () => {
    vi.useFakeTimers();
    const rafSpy = vi.spyOn(globalThis, 'requestAnimationFrame').mockImplementation((cb) => { cb(0); return 0; });
    announcer.announce('Deleted Wire');
    expect(announcer.getCurrentMessage()).toBe('Deleted Wire');
    vi.advanceTimersByTime(1100);
    expect(announcer.getCurrentMessage()).toBe('');
    rafSpy.mockRestore();
    vi.useRealTimers();
  });

  it('should remove the live region on destroy', () => {
    announcer.destroy();
    const liveRegion = document.querySelector('[data-testid="canvas-announcer"]');
    expect(liveRegion).toBeNull();
  });

  it('should handle multiple announces gracefully', async () => {
    announcer.announce('First');
    await new Promise((resolve) => { requestAnimationFrame(resolve); });
    announcer.announce('Second');
    await new Promise((resolve) => { requestAnimationFrame(resolve); });
    expect(announcer.getCurrentMessage()).toBe('Second');
  });

  it('should not throw when announcing after destroy', () => {
    announcer.destroy();
    expect(() => announcer.announce('After destroy')).not.toThrow();
  });

  it('should handle getCurrentMessage when destroyed', () => {
    announcer.destroy();
    expect(announcer.getCurrentMessage()).toBe('');
  });

  it('should support multiple concurrent announcers', async () => {
    const announcer2 = new CanvasAnnouncer();
    announcer.announce('From announcer 1');
    announcer2.announce('From announcer 2');
    await new Promise((resolve) => { requestAnimationFrame(resolve); });

    const regions = document.querySelectorAll('[data-testid="canvas-announcer"]');
    expect(regions.length).toBe(2);

    announcer2.destroy();
  });
});

// ---------------------------------------------------------------------------
// Type exports (compile-time verification)
// ---------------------------------------------------------------------------

describe('Type exports', () => {
  it('should export all required types', () => {
    // This test verifies that types are properly exported and usable
    const labelOpts: AriaLabelOptions = { entityType: 'component' };
    const announceOpts: AnnouncementOptions = { action: 'select' };
    const _view: CanvasView = 'schematic';
    const _entity: CanvasEntityType = 'component';
    const _action: CanvasAction = 'select';
    const _tool: CanvasTool = 'select';

    expect(getAriaLabel(labelOpts)).toBeDefined();
    expect(getActionAnnouncement(announceOpts)).toBeDefined();
  });
});
