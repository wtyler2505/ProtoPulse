import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import {
  ViolationNavigator,
  classifyViolation,
  resolveLocation,
} from '../violation-navigator';
import type {
  ViolationInput,
  ViolationLocation,
  NavigationRequest,
  ViolationViewType,
} from '../violation-navigator';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeViolation(overrides: Partial<ViolationInput> = {}): ViolationInput {
  return {
    id: 'v-1',
    ruleType: 'min-clearance',
    severity: 'error',
    message: 'Clearance violation',
    shapeIds: ['s1', 's2'],
    location: { x: 100, y: 200 },
    ...overrides,
  };
}

// ---------------------------------------------------------------------------
// classifyViolation
// ---------------------------------------------------------------------------

describe('classifyViolation', () => {
  // --- PCB rules ---

  it('classifies min-clearance as pcb', () => {
    expect(classifyViolation(makeViolation({ ruleType: 'min-clearance' }))).toBe('pcb');
  });

  it('classifies min-trace-width as pcb', () => {
    expect(classifyViolation(makeViolation({ ruleType: 'min-trace-width' }))).toBe('pcb');
  });

  it('classifies courtyard-overlap as pcb', () => {
    expect(classifyViolation(makeViolation({ ruleType: 'courtyard-overlap' }))).toBe('pcb');
  });

  it('classifies pad-size as pcb', () => {
    expect(classifyViolation(makeViolation({ ruleType: 'pad-size' }))).toBe('pcb');
  });

  it('classifies silk-overlap as pcb', () => {
    expect(classifyViolation(makeViolation({ ruleType: 'silk-overlap' }))).toBe('pcb');
  });

  it('classifies annular-ring as pcb', () => {
    expect(classifyViolation(makeViolation({ ruleType: 'annular-ring' }))).toBe('pcb');
  });

  it('classifies trace_clearance (board-level) as pcb', () => {
    expect(classifyViolation(makeViolation({ ruleType: 'trace_clearance' }))).toBe('pcb');
  });

  it('classifies via_drill_min as pcb', () => {
    expect(classifyViolation(makeViolation({ ruleType: 'via_drill_min' }))).toBe('pcb');
  });

  it('classifies copper_pour_clearance as pcb', () => {
    expect(classifyViolation(makeViolation({ ruleType: 'copper_pour_clearance' }))).toBe('pcb');
  });

  it('classifies diff_pair_spacing as pcb', () => {
    expect(classifyViolation(makeViolation({ ruleType: 'diff_pair_spacing' }))).toBe('pcb');
  });

  it('classifies board_edge_clearance as pcb', () => {
    expect(classifyViolation(makeViolation({ ruleType: 'board_edge_clearance' }))).toBe('pcb');
  });

  // --- ERC rules ---

  it('classifies unconnected-pin as schematic', () => {
    expect(classifyViolation(makeViolation({ ruleType: 'unconnected-pin' }))).toBe('schematic');
  });

  it('classifies shorted-power as schematic', () => {
    expect(classifyViolation(makeViolation({ ruleType: 'shorted-power' }))).toBe('schematic');
  });

  it('classifies floating-input as schematic', () => {
    expect(classifyViolation(makeViolation({ ruleType: 'floating-input' }))).toBe('schematic');
  });

  it('classifies driver-conflict as schematic', () => {
    expect(classifyViolation(makeViolation({ ruleType: 'driver-conflict' }))).toBe('schematic');
  });

  it('classifies power-net-unnamed as schematic', () => {
    expect(classifyViolation(makeViolation({ ruleType: 'power-net-unnamed' }))).toBe('schematic');
  });

  // --- Architecture rules ---

  it('classifies connectivity as architecture', () => {
    expect(classifyViolation(makeViolation({ ruleType: 'connectivity' }))).toBe('architecture');
  });

  it('classifies power as architecture', () => {
    expect(classifyViolation(makeViolation({ ruleType: 'power' }))).toBe('architecture');
  });

  it('classifies naming as architecture', () => {
    expect(classifyViolation(makeViolation({ ruleType: 'naming' }))).toBe('architecture');
  });

  it('classifies completeness as architecture', () => {
    expect(classifyViolation(makeViolation({ ruleType: 'completeness' }))).toBe('architecture');
  });

  // --- Explicit view field ---

  it('uses explicit view field when present', () => {
    expect(classifyViolation(makeViolation({ ruleType: 'unknown-rule', view: 'breadboard' }))).toBe('breadboard');
  });

  it('explicit view overrides rule-type classification', () => {
    expect(classifyViolation(makeViolation({ ruleType: 'min-clearance', view: 'schematic' }))).toBe('schematic');
  });

  // --- DFM category ---

  it('classifies DFM drill category as pcb', () => {
    expect(classifyViolation(makeViolation({ ruleType: 'custom-dfm', category: 'drill' }))).toBe('pcb');
  });

  it('classifies DFM silkscreen category as pcb', () => {
    expect(classifyViolation(makeViolation({ ruleType: 'custom-dfm', category: 'silkscreen' }))).toBe('pcb');
  });

  // --- Heuristic: underscores ---

  it('classifies unknown underscore rule as pcb (heuristic)', () => {
    expect(classifyViolation(makeViolation({ ruleType: 'new_pcb_rule' }))).toBe('pcb');
  });

  // --- Heuristic: keyword matching ---

  it('classifies unknown rule with trace keyword as pcb', () => {
    expect(classifyViolation(makeViolation({ ruleType: 'trace-something' }))).toBe('pcb');
  });

  it('classifies unknown rule with via keyword as pcb', () => {
    expect(classifyViolation(makeViolation({ ruleType: 'custom-via-check' }))).toBe('pcb');
  });

  // --- Fallback ---

  it('falls back to architecture for completely unknown rules', () => {
    expect(classifyViolation(makeViolation({ ruleType: 'xyzzy' }))).toBe('architecture');
  });
});

// ---------------------------------------------------------------------------
// resolveLocation
// ---------------------------------------------------------------------------

describe('resolveLocation', () => {
  it('returns pcb viewType for PCB DRC violations', () => {
    const loc = resolveLocation(makeViolation({ ruleType: 'trace_clearance' }));
    expect(loc.viewType).toBe('pcb');
  });

  it('returns schematic viewType for ERC violations', () => {
    const loc = resolveLocation(makeViolation({ ruleType: 'unconnected-pin' }));
    expect(loc.viewType).toBe('schematic');
  });

  it('extracts coordinates from violation location', () => {
    const loc = resolveLocation(makeViolation({ location: { x: 42, y: 99 } }));
    expect(loc.coordinates).toEqual({ x: 42, y: 99 });
  });

  it('defaults coordinates to {0,0} when no location provided', () => {
    const loc = resolveLocation(makeViolation({ location: undefined }));
    expect(loc.coordinates).toEqual({ x: 0, y: 0 });
  });

  it('uses first shapeId as entityId', () => {
    const loc = resolveLocation(makeViolation({ shapeIds: ['shape-a', 'shape-b'] }));
    expect(loc.entityId).toBe('shape-a');
  });

  it('sets entityType to instance when instanceId is present', () => {
    const loc = resolveLocation(makeViolation({ instanceId: 42, ruleType: 'unconnected-pin' }));
    expect(loc.entityType).toBe('instance');
    expect(loc.entityId).toBe('42');
  });

  it('sets entityType to net when netId is present', () => {
    const loc = resolveLocation(makeViolation({ netId: 7, ruleType: 'floating-input' }));
    expect(loc.entityType).toBe('net');
    expect(loc.entityId).toBe('7');
  });

  it('uses elementId when provided', () => {
    const loc = resolveLocation(makeViolation({ elementId: 'el-99', shapeIds: undefined }));
    expect(loc.entityId).toBe('el-99');
  });

  it('infers trace entityType for trace-related rules', () => {
    const loc = resolveLocation(makeViolation({ ruleType: 'min-trace-width', elementId: 'e1' }));
    expect(loc.entityType).toBe('trace');
  });

  it('infers pad entityType for pad-related rules', () => {
    const loc = resolveLocation(makeViolation({ ruleType: 'pad-size', elementId: 'e1' }));
    expect(loc.entityType).toBe('pad');
  });

  it('infers via entityType for via-related rules', () => {
    const loc = resolveLocation(makeViolation({ ruleType: 'via_drill_min', elementId: 'e1' }));
    expect(loc.entityType).toBe('via');
  });

  it('infers zone entityType for pour-related rules', () => {
    const loc = resolveLocation(makeViolation({ ruleType: 'copper_pour_clearance', elementId: 'e1' }));
    expect(loc.entityType).toBe('zone');
  });

  it('defaults entityType to shape when no inference matches', () => {
    const loc = resolveLocation(makeViolation({ ruleType: 'courtyard-overlap', elementId: 'e1' }));
    expect(loc.entityType).toBe('shape');
  });

  it('returns a positive radius', () => {
    const loc = resolveLocation(makeViolation());
    expect(loc.radius).toBeGreaterThan(0);
  });

  it('handles empty shapeIds gracefully', () => {
    const loc = resolveLocation(makeViolation({ shapeIds: [] }));
    expect(loc.entityId).toBe('');
    expect(loc.entityType).toBe('shape'); // no entity to infer from
  });
});

// ---------------------------------------------------------------------------
// ViolationNavigator singleton
// ---------------------------------------------------------------------------

describe('ViolationNavigator', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    ViolationNavigator.resetInstance();
  });

  afterEach(() => {
    ViolationNavigator.resetInstance();
    vi.useRealTimers();
  });

  // --- Singleton pattern ---

  it('returns the same instance from getInstance()', () => {
    const a = ViolationNavigator.getInstance();
    const b = ViolationNavigator.getInstance();
    expect(a).toBe(b);
  });

  it('returns a fresh instance after resetInstance()', () => {
    const a = ViolationNavigator.getInstance();
    ViolationNavigator.resetInstance();
    const b = ViolationNavigator.getInstance();
    expect(a).not.toBe(b);
  });

  it('getSnapshot returns null initially', () => {
    const nav = ViolationNavigator.getInstance();
    expect(nav.getSnapshot()).toBeNull();
  });

  // --- subscribe ---

  it('subscribe returns an unsubscribe function', () => {
    const nav = ViolationNavigator.getInstance();
    const unsub = nav.subscribe(vi.fn());
    expect(typeof unsub).toBe('function');
    unsub();
  });

  it('subscriber is called when highlight changes', () => {
    const nav = ViolationNavigator.getInstance();
    const cb = vi.fn();
    nav.subscribe(cb);

    nav.navigate(makeViolation());
    expect(cb).toHaveBeenCalled();
  });

  it('unsubscribed listener is not called', () => {
    const nav = ViolationNavigator.getInstance();
    const cb = vi.fn();
    const unsub = nav.subscribe(cb);
    unsub();

    nav.navigate(makeViolation());
    expect(cb).not.toHaveBeenCalled();
  });

  // --- navigate ---

  it('navigate sets active highlight', () => {
    const nav = ViolationNavigator.getInstance();
    nav.navigate(makeViolation({ id: 'v-10' }));

    const h = nav.getActiveHighlight();
    expect(h).not.toBeNull();
    expect(h!.violationId).toBe('v-10');
  });

  it('navigate returns a NavigationRequest', () => {
    const nav = ViolationNavigator.getInstance();
    const req = nav.navigate(makeViolation());

    expect(req.violationId).toBe('v-1');
    expect(req.highlight).toBe(true);
    expect(req.pulse).toBe(true);
    expect(req.severity).toBe('error');
  });

  it('navigate includes resolved location', () => {
    const nav = ViolationNavigator.getInstance();
    const req = nav.navigate(makeViolation({ ruleType: 'trace_clearance', location: { x: 10, y: 20 } }));

    expect(req.location.viewType).toBe('pcb');
    expect(req.location.coordinates).toEqual({ x: 10, y: 20 });
  });

  it('navigate replaces previous highlight', () => {
    const nav = ViolationNavigator.getInstance();
    nav.navigate(makeViolation({ id: 'first' }));
    nav.navigate(makeViolation({ id: 'second' }));

    expect(nav.getActiveHighlight()!.violationId).toBe('second');
  });

  it('navigate preserves severity in request', () => {
    const nav = ViolationNavigator.getInstance();
    const req = nav.navigate(makeViolation({ severity: 'warning' }));
    expect(req.severity).toBe('warning');
  });

  // --- onNavigate ---

  it('onNavigate callback is called on navigate', () => {
    const nav = ViolationNavigator.getInstance();
    const cb = vi.fn();
    nav.onNavigate(cb);

    nav.navigate(makeViolation());
    expect(cb).toHaveBeenCalledTimes(1);
    expect(cb.mock.calls[0][0].violationId).toBe('v-1');
  });

  it('multiple onNavigate listeners all called', () => {
    const nav = ViolationNavigator.getInstance();
    const cb1 = vi.fn();
    const cb2 = vi.fn();
    nav.onNavigate(cb1);
    nav.onNavigate(cb2);

    nav.navigate(makeViolation());
    expect(cb1).toHaveBeenCalledTimes(1);
    expect(cb2).toHaveBeenCalledTimes(1);
  });

  it('unsubscribed onNavigate listener is not called', () => {
    const nav = ViolationNavigator.getInstance();
    const cb = vi.fn();
    const unsub = nav.onNavigate(cb);
    unsub();

    nav.navigate(makeViolation());
    expect(cb).not.toHaveBeenCalled();
  });

  it('onNavigate receives correct view type', () => {
    const nav = ViolationNavigator.getInstance();
    const cb = vi.fn();
    nav.onNavigate(cb);

    nav.navigate(makeViolation({ ruleType: 'unconnected-pin' }));
    expect(cb.mock.calls[0][0].location.viewType).toBe('schematic');
  });

  it('onNavigate receives correct view for PCB DRC', () => {
    const nav = ViolationNavigator.getInstance();
    const cb = vi.fn();
    nav.onNavigate(cb);

    nav.navigate(makeViolation({ ruleType: 'trace_clearance' }));
    expect(cb.mock.calls[0][0].location.viewType).toBe('pcb');
  });

  // --- getActiveHighlight / clearHighlight ---

  it('getActiveHighlight returns null before any navigation', () => {
    const nav = ViolationNavigator.getInstance();
    expect(nav.getActiveHighlight()).toBeNull();
  });

  it('clearHighlight removes active highlight', () => {
    const nav = ViolationNavigator.getInstance();
    nav.navigate(makeViolation());
    expect(nav.getActiveHighlight()).not.toBeNull();

    nav.clearHighlight();
    expect(nav.getActiveHighlight()).toBeNull();
  });

  it('clearHighlight notifies subscribers', () => {
    const nav = ViolationNavigator.getInstance();
    nav.navigate(makeViolation());
    const cb = vi.fn();
    nav.subscribe(cb);

    nav.clearHighlight();
    expect(cb).toHaveBeenCalled();
  });

  it('clearHighlight is idempotent', () => {
    const nav = ViolationNavigator.getInstance();
    nav.clearHighlight();
    nav.clearHighlight();
    expect(nav.getActiveHighlight()).toBeNull();
  });

  it('clearHighlight does not notify if already null', () => {
    const nav = ViolationNavigator.getInstance();
    const cb = vi.fn();
    nav.subscribe(cb);

    nav.clearHighlight();
    expect(cb).not.toHaveBeenCalled();
  });

  // --- highlightTimeout (auto-clear after 3s) ---

  it('auto-clears highlight after 3 seconds', () => {
    const nav = ViolationNavigator.getInstance();
    nav.navigate(makeViolation());
    expect(nav.getActiveHighlight()).not.toBeNull();

    vi.advanceTimersByTime(3000);
    expect(nav.getActiveHighlight()).toBeNull();
  });

  it('auto-clear notifies subscribers', () => {
    const nav = ViolationNavigator.getInstance();
    nav.navigate(makeViolation());

    const cb = vi.fn();
    nav.subscribe(cb);

    vi.advanceTimersByTime(3000);
    expect(cb).toHaveBeenCalled();
  });

  it('new navigate resets the timer', () => {
    const nav = ViolationNavigator.getInstance();
    nav.navigate(makeViolation({ id: 'first' }));

    // Advance 2 seconds
    vi.advanceTimersByTime(2000);
    expect(nav.getActiveHighlight()).not.toBeNull();

    // Navigate again (resets timer)
    nav.navigate(makeViolation({ id: 'second' }));

    // Advance another 2 seconds (total 4s from first, 2s from second)
    vi.advanceTimersByTime(2000);
    expect(nav.getActiveHighlight()).not.toBeNull();
    expect(nav.getActiveHighlight()!.violationId).toBe('second');

    // Advance 1 more second (3s from second)
    vi.advanceTimersByTime(1000);
    expect(nav.getActiveHighlight()).toBeNull();
  });

  it('clearHighlight cancels pending timer', () => {
    const nav = ViolationNavigator.getInstance();
    nav.navigate(makeViolation());
    nav.clearHighlight();

    const cb = vi.fn();
    nav.subscribe(cb);

    // Timer should have been cancelled — no notification at 3s
    vi.advanceTimersByTime(3000);
    expect(cb).not.toHaveBeenCalled();
  });

  // --- Edge cases ---

  it('handles violation with no coordinates', () => {
    const nav = ViolationNavigator.getInstance();
    const req = nav.navigate(makeViolation({ location: undefined }));
    expect(req.location.coordinates).toEqual({ x: 0, y: 0 });
  });

  it('handles violation with unknown rule type', () => {
    const nav = ViolationNavigator.getInstance();
    const req = nav.navigate(makeViolation({ ruleType: 'totally-unknown-rule' }));
    // Falls back to architecture
    expect(req.location.viewType).toBe('architecture');
  });

  it('handles rapid sequential navigations', () => {
    const nav = ViolationNavigator.getInstance();
    const cb = vi.fn();
    nav.onNavigate(cb);

    nav.navigate(makeViolation({ id: 'a' }));
    nav.navigate(makeViolation({ id: 'b' }));
    nav.navigate(makeViolation({ id: 'c' }));

    expect(cb).toHaveBeenCalledTimes(3);
    expect(nav.getActiveHighlight()!.violationId).toBe('c');
  });

  it('rapid navigations only leave one active timer', () => {
    const nav = ViolationNavigator.getInstance();
    nav.navigate(makeViolation({ id: 'a' }));
    nav.navigate(makeViolation({ id: 'b' }));

    // After 3s only the last timer fires
    vi.advanceTimersByTime(3000);
    expect(nav.getActiveHighlight()).toBeNull();
  });

  it('handles violation with empty shapeIds', () => {
    const nav = ViolationNavigator.getInstance();
    const req = nav.navigate(makeViolation({ shapeIds: [] }));
    expect(req.location.entityId).toBe('');
  });

  it('handles violation with no shapeIds', () => {
    const nav = ViolationNavigator.getInstance();
    const req = nav.navigate(makeViolation({ shapeIds: undefined }));
    expect(req.location.entityId).toBe('');
  });

  // --- Static conversion helpers ---

  describe('fromDRCViolation', () => {
    it('converts a DRCViolation to ViolationInput', () => {
      const drc = {
        id: 'drc-1',
        ruleType: 'min-clearance' as const,
        severity: 'error' as const,
        message: 'Too close',
        shapeIds: ['s1'],
        view: 'pcb' as const,
        location: { x: 5, y: 10 },
      };
      const input = ViolationNavigator.fromDRCViolation(drc);
      expect(input.id).toBe('drc-1');
      expect(input.ruleType).toBe('min-clearance');
      expect(input.view).toBe('pcb');
      expect(input.shapeIds).toEqual(['s1']);
    });
  });

  describe('fromERCViolation', () => {
    it('converts an ERCViolation to ViolationInput', () => {
      const erc = {
        id: 'erc-1',
        ruleType: 'unconnected-pin' as const,
        severity: 'warning' as const,
        message: 'Pin not connected',
        instanceId: 42,
        pin: 'VCC',
        netId: 7,
        location: { x: 15, y: 25 },
      };
      const input = ViolationNavigator.fromERCViolation(erc);
      expect(input.id).toBe('erc-1');
      expect(input.instanceId).toBe(42);
      expect(input.pin).toBe('VCC');
      expect(input.netId).toBe(7);
    });
  });

  describe('fromDfmViolation', () => {
    it('converts a DfmViolation to ViolationInput', () => {
      const dfm = {
        id: 'dfm-1',
        ruleId: 'min-drill',
        ruleName: 'Minimum Drill',
        severity: 'error' as const,
        category: 'drill' as const,
        message: 'Drill too small',
        actual: 0.2,
        required: 0.3,
        unit: 'mm',
        location: { x: 30, y: 40 },
        elementId: 'pad-99',
      };
      const input = ViolationNavigator.fromDfmViolation(dfm);
      expect(input.id).toBe('dfm-1');
      expect(input.ruleType).toBe('min-drill');
      expect(input.elementId).toBe('pad-99');
      expect(input.category).toBe('drill');
    });

    it('maps DFM info severity to warning', () => {
      const dfm = {
        id: 'dfm-2',
        ruleId: 'silk-width',
        ruleName: 'Silk Width',
        severity: 'info' as const,
        category: 'silkscreen' as const,
        message: 'Thin silk',
        actual: 0.1,
        required: 0.15,
        unit: 'mm',
      };
      const input = ViolationNavigator.fromDfmViolation(dfm);
      expect(input.severity).toBe('warning');
    });
  });
});
