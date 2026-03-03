/**
 * Tests for PCB layout extracted pure-logic modules.
 *
 * Covers:
 *   - PCBCoordinateSystem: screen-to-board transforms, snapping, zoom
 *   - ComponentPlacer: ratsnest construction, placement validation, footprint styling
 *   - LayerManager: layer toggling, visibility, color classes, presets
 */

import { describe, it, expect } from 'vitest';
import {
  screenToBoardCoords,
  snapValue,
  snapToGrid,
  clampZoom,
  computeWheelZoom,
  roundForDisplay,
  svgUnitsToMm,
  mmToSvgUnits,
  GRID_STEP,
  MIN_ZOOM,
  MAX_ZOOM,
  DEFAULT_BOARD,
  DEFAULT_ZOOM,
  DEFAULT_PAN,
} from '../PCBCoordinateSystem';
import {
  buildRatsnestNets,
  isInstancePlaced,
  countPlacedInstances,
  footprintFill,
  footprintStroke,
  footprintStrokeWidth,
} from '../ComponentPlacer';
import {
  layerLabel,
  toggleLayer,
  wireOpacity,
  layerToggleClasses,
  TRACE_COLORS,
  WIRE_COLORS,
  TRACE_WIDTH_PRESETS,
  DEFAULT_TRACE_WIDTH,
} from '../LayerManager';
import {
  handleCanvasClick,
  handleDoubleClick,
  handleKeyDown,
  handleMouseDown,
  handleMouseUp,
} from '../PCBInteractionManager';
import type { CanvasCallbacks, PanState, TraceFinishParams, DeleteParams } from '../PCBInteractionManager';
import type { CircuitInstanceRow } from '@shared/schema';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeSvgRect(left = 0, top = 0, width = 800, height = 600): DOMRect {
  return {
    left,
    top,
    width,
    height,
    right: left + width,
    bottom: top + height,
    x: left,
    y: top,
    toJSON: () => ({}),
  };
}

function makeInstance(overrides: Partial<CircuitInstanceRow> = {}): CircuitInstanceRow {
  return {
    id: 1,
    circuitDesignId: 1,
    componentId: null,
    referenceDesignator: 'U1',
    x: 100,
    y: 100,
    rotation: 0,
    pcbX: null,
    pcbY: null,
    pcbRotation: 0,
    pcbSide: 'front',
    properties: null,
    ...overrides,
  } as CircuitInstanceRow;
}

// ============================================================================
// PCBCoordinateSystem
// ============================================================================

describe('PCBCoordinateSystem', () => {
  describe('screenToBoardCoords', () => {
    it('converts screen coordinates with no pan/zoom', () => {
      const result = screenToBoardCoords(100, 50, makeSvgRect(), 0, 0, 1);
      expect(result).toEqual({ x: 100, y: 50 });
    });

    it('accounts for pan offset', () => {
      const result = screenToBoardCoords(140, 80, makeSvgRect(), 40, 30, 1);
      expect(result).toEqual({ x: 100, y: 50 });
    });

    it('accounts for zoom', () => {
      const result = screenToBoardCoords(200, 100, makeSvgRect(), 0, 0, 2);
      expect(result).toEqual({ x: 100, y: 50 });
    });

    it('accounts for pan + zoom together', () => {
      const result = screenToBoardCoords(240, 130, makeSvgRect(), 40, 30, 2);
      expect(result).toEqual({ x: 100, y: 50 });
    });

    it('accounts for SVG offset position', () => {
      const result = screenToBoardCoords(110, 60, makeSvgRect(10, 10), 0, 0, 1);
      expect(result).toEqual({ x: 100, y: 50 });
    });
  });

  describe('snapToGrid', () => {
    it('snaps a point to the nearest grid intersection', () => {
      // GRID_STEP = 12.7; 13/12.7 = 1.02 rounds to 1 → 12.7; 6/12.7 = 0.47 rounds to 0 → 0
      const result = snapToGrid(13, 6);
      expect(result.x).toBeCloseTo(GRID_STEP);
      expect(result.y).toBeCloseTo(0);

      // 7/12.7 = 0.55 rounds to 1 → 12.7
      const result2 = snapToGrid(13, 7);
      expect(result2.y).toBeCloseTo(GRID_STEP);
    });

    it('snaps zero to zero', () => {
      const result = snapToGrid(0, 0);
      expect(result).toEqual({ x: 0, y: 0 });
    });

    it('rounds to nearest grid point', () => {
      // 12.7 / 2 = 6.35 → anything above rounds up, below rounds down
      const above = snapToGrid(7, 7);
      expect(above.x).toBeCloseTo(GRID_STEP);

      const below = snapToGrid(5, 5);
      expect(below.x).toBeCloseTo(0);
    });

    it('supports custom grid step', () => {
      const result = snapToGrid(7, 7, 5);
      expect(result).toEqual({ x: 5, y: 5 });
    });
  });

  describe('snapValue', () => {
    it('snaps single value', () => {
      expect(snapValue(13)).toBeCloseTo(GRID_STEP);
    });

    it('snaps to custom grid', () => {
      expect(snapValue(7.3, 5)).toBe(5);
    });
  });

  describe('clampZoom', () => {
    it('clamps below minimum', () => {
      expect(clampZoom(0.1)).toBe(MIN_ZOOM);
    });

    it('clamps above maximum', () => {
      expect(clampZoom(10)).toBe(MAX_ZOOM);
    });

    it('passes through in-range values', () => {
      expect(clampZoom(2)).toBe(2);
    });
  });

  describe('computeWheelZoom', () => {
    it('zooms out on positive deltaY', () => {
      const result = computeWheelZoom(1.5, 100);
      expect(result).toBeLessThan(1.5);
    });

    it('zooms in on negative deltaY', () => {
      const result = computeWheelZoom(1.5, -100);
      expect(result).toBeGreaterThan(1.5);
    });

    it('respects min zoom', () => {
      const result = computeWheelZoom(MIN_ZOOM, 100);
      expect(result).toBeGreaterThanOrEqual(MIN_ZOOM);
    });

    it('respects max zoom', () => {
      const result = computeWheelZoom(MAX_ZOOM, -100);
      expect(result).toBeLessThanOrEqual(MAX_ZOOM);
    });
  });

  describe('roundForDisplay', () => {
    it('rounds to 1 decimal place', () => {
      expect(roundForDisplay(12.345)).toBe(12.3);
    });

    it('preserves exact tenths', () => {
      expect(roundForDisplay(5.1)).toBe(5.1);
    });
  });

  describe('unit conversions', () => {
    it('converts SVG units to mm', () => {
      expect(svgUnitsToMm(500)).toBe(50);
    });

    it('converts mm to SVG units', () => {
      expect(mmToSvgUnits(50)).toBe(500);
    });

    it('round-trips correctly', () => {
      expect(mmToSvgUnits(svgUnitsToMm(127))).toBe(127);
    });
  });

  describe('constants', () => {
    it('has sensible defaults', () => {
      expect(DEFAULT_BOARD.width).toBe(500);
      expect(DEFAULT_BOARD.height).toBe(400);
      expect(DEFAULT_ZOOM).toBe(1.5);
      expect(DEFAULT_PAN).toEqual({ x: 40, y: 40 });
      expect(GRID_STEP).toBe(12.7);
    });
  });
});

// ============================================================================
// ComponentPlacer
// ============================================================================

describe('ComponentPlacer', () => {
  describe('isInstancePlaced', () => {
    it('returns false when pcb coords are null', () => {
      expect(isInstancePlaced(makeInstance())).toBe(false);
    });

    it('returns true when pcb coords are set', () => {
      expect(isInstancePlaced(makeInstance({ pcbX: 10, pcbY: 20 }))).toBe(true);
    });

    it('returns false when only pcbX is set', () => {
      expect(isInstancePlaced(makeInstance({ pcbX: 10 }))).toBe(false);
    });
  });

  describe('countPlacedInstances', () => {
    it('returns 0 for empty array', () => {
      expect(countPlacedInstances([])).toBe(0);
    });

    it('counts only placed instances', () => {
      const instances = [
        makeInstance({ id: 1, pcbX: 10, pcbY: 20 }),
        makeInstance({ id: 2 }),
        makeInstance({ id: 3, pcbX: 30, pcbY: 40 }),
      ];
      expect(countPlacedInstances(instances)).toBe(2);
    });
  });

  describe('footprintFill', () => {
    it('returns blue-tinted fill for back side', () => {
      expect(footprintFill('back')).toBe('#2563eb20');
    });

    it('returns red-tinted fill for front side', () => {
      expect(footprintFill('front')).toBe('#dc262620');
    });

    it('returns red-tinted fill for null', () => {
      expect(footprintFill(null)).toBe('#dc262620');
    });
  });

  describe('footprintStroke', () => {
    it('returns yellow for selected', () => {
      expect(footprintStroke('front', true)).toBe('#facc15');
      expect(footprintStroke('back', true)).toBe('#facc15');
    });

    it('returns blue for back (unselected)', () => {
      expect(footprintStroke('back', false)).toBe('#3b82f6');
    });

    it('returns red for front (unselected)', () => {
      expect(footprintStroke('front', false)).toBe('#ef4444');
    });
  });

  describe('footprintStrokeWidth', () => {
    it('returns wider stroke for selected', () => {
      expect(footprintStrokeWidth(true)).toBe(0.8);
    });

    it('returns thinner stroke for unselected', () => {
      expect(footprintStrokeWidth(false)).toBe(0.4);
    });
  });

  describe('buildRatsnestNets', () => {
    it('returns empty array for no nets', () => {
      expect(buildRatsnestNets([], [])).toEqual([]);
    });

    it('returns empty pins when no instances have pcb coords', () => {
      const nets = [
        {
          id: 1,
          name: 'GND',
          segments: [{ fromInstanceId: 1, fromPin: '1', toInstanceId: 2, toPin: '1' }],
        },
      ];
      const instances = [makeInstance({ id: 1 }), makeInstance({ id: 2 })];
      const result = buildRatsnestNets(nets, instances);
      expect(result).toHaveLength(1);
      expect(result[0].pins).toHaveLength(0);
    });

    it('builds pins from placed instances', () => {
      const nets = [
        {
          id: 1,
          name: 'VCC',
          segments: [{ fromInstanceId: 1, fromPin: 'A', toInstanceId: 2, toPin: 'B' }],
        },
      ];
      const instances = [
        makeInstance({ id: 1, pcbX: 10, pcbY: 20 }),
        makeInstance({ id: 2, pcbX: 30, pcbY: 40 }),
      ];
      const result = buildRatsnestNets(nets, instances);
      expect(result).toHaveLength(1);
      expect(result[0].pins).toHaveLength(2);
      expect(result[0].pins[0]).toEqual({ instanceId: 1, pinId: 'A', x: 10, y: 20 });
      expect(result[0].pins[1]).toEqual({ instanceId: 2, pinId: 'B', x: 30, y: 40 });
    });

    it('assigns cycling wire colors', () => {
      const nets = WIRE_COLORS.map((_, i) => ({ id: i, name: `N${i}`, segments: [] }));
      // Add one more to verify cycling
      nets.push({ id: nets.length, name: `N${nets.length}`, segments: [] });
      const result = buildRatsnestNets(nets, []);
      expect(result[0].color).toBe(WIRE_COLORS[0]);
      expect(result[WIRE_COLORS.length].color).toBe(WIRE_COLORS[0]); // wraps around
    });

    it('handles null segments gracefully', () => {
      const nets = [{ id: 1, name: 'N1', segments: null }];
      const result = buildRatsnestNets(nets, []);
      expect(result).toHaveLength(1);
      expect(result[0].pins).toHaveLength(0);
    });
  });
});

// ============================================================================
// LayerManager
// ============================================================================

describe('LayerManager', () => {
  describe('toggleLayer', () => {
    it('toggles front to back', () => {
      expect(toggleLayer('front')).toBe('back');
    });

    it('toggles back to front', () => {
      expect(toggleLayer('back')).toBe('front');
    });
  });

  describe('layerLabel', () => {
    it('returns front label', () => {
      expect(layerLabel('front')).toBe('F.Cu (Front)');
    });

    it('returns back label', () => {
      expect(layerLabel('back')).toBe('B.Cu (Back)');
    });
  });

  describe('wireOpacity', () => {
    it('returns high opacity for matching layer', () => {
      expect(wireOpacity('front', 'front')).toBe(0.9);
      expect(wireOpacity('back', 'back')).toBe(0.9);
    });

    it('returns low opacity for non-matching layer', () => {
      expect(wireOpacity('front', 'back')).toBe(0.3);
      expect(wireOpacity('back', 'front')).toBe(0.3);
    });
  });

  describe('layerToggleClasses', () => {
    it('returns red classes for front layer', () => {
      expect(layerToggleClasses('front')).toContain('red');
    });

    it('returns blue classes for back layer', () => {
      expect(layerToggleClasses('back')).toContain('blue');
    });
  });

  describe('constants', () => {
    it('has trace colors for both layers', () => {
      expect(TRACE_COLORS.front).toBe('#e74c3c');
      expect(TRACE_COLORS.back).toBe('#3498db');
    });

    it('has 10 wire colors', () => {
      expect(WIRE_COLORS).toHaveLength(10);
    });

    it('has standard trace width presets', () => {
      expect(TRACE_WIDTH_PRESETS).toEqual([0.15, 0.25, 0.5, 1.0, 2.0]);
    });

    it('has a default trace width in the presets', () => {
      expect(TRACE_WIDTH_PRESETS).toContain(DEFAULT_TRACE_WIDTH);
    });
  });
});

// ============================================================================
// PCBInteractionManager
// ============================================================================

describe('PCBInteractionManager', () => {
  // Helpers for creating mock callbacks and event objects
  function makeCallbacks(overrides: Partial<CanvasCallbacks> = {}): CanvasCallbacks {
    return {
      setTool: overrides.setTool ?? (() => undefined),
      setActiveLayer: overrides.setActiveLayer ?? (() => undefined),
      setZoom: overrides.setZoom ?? (() => undefined),
      setPanOffset: overrides.setPanOffset ?? (() => undefined),
      setSelectedInstanceId: overrides.setSelectedInstanceId ?? (() => undefined),
      setSelectedWireId: overrides.setSelectedWireId ?? (() => undefined),
      setTracePoints: overrides.setTracePoints ?? (() => undefined),
      setMouseBoardPos: overrides.setMouseBoardPos ?? (() => undefined),
    };
  }

  function makeMouseEvent(overrides: Partial<React.MouseEvent> = {}): React.MouseEvent {
    return {
      clientX: 100,
      clientY: 50,
      button: 0,
      preventDefault: () => undefined,
      stopPropagation: () => undefined,
      ...overrides,
    } as unknown as React.MouseEvent;
  }

  function makeKeyEvent(key: string): React.KeyboardEvent {
    return { key } as unknown as React.KeyboardEvent;
  }

  describe('handleCanvasClick', () => {
    it('clears selection when tool is select', () => {
      let clearedInstanceId = false;
      let clearedWireId = false;
      const cbs = makeCallbacks({
        setSelectedInstanceId: () => { clearedInstanceId = true; },
        setSelectedWireId: () => { clearedWireId = true; },
      });
      handleCanvasClick('select', null, { x: 0, y: 0 }, 1, cbs, makeMouseEvent());
      expect(clearedInstanceId).toBe(true);
      expect(clearedWireId).toBe(true);
    });

    it('adds a trace point when tool is trace and svg element exists', () => {
      let traceUpdated = false;
      const cbs = makeCallbacks({
        setTracePoints: () => { traceUpdated = true; },
      });
      // Create a minimal SVG element mock with getBoundingClientRect
      const mockSvg = {
        getBoundingClientRect: () => makeSvgRect(0, 0, 800, 600),
      } as unknown as SVGSVGElement;
      handleCanvasClick('trace', mockSvg, { x: 0, y: 0 }, 1, cbs, makeMouseEvent());
      expect(traceUpdated).toBe(true);
    });

    it('does nothing in trace mode when svg is null', () => {
      let traceUpdated = false;
      const cbs = makeCallbacks({
        setTracePoints: () => { traceUpdated = true; },
      });
      handleCanvasClick('trace', null, { x: 0, y: 0 }, 1, cbs, makeMouseEvent());
      expect(traceUpdated).toBe(false);
    });
  });

  describe('handleDoubleClick', () => {
    it('creates a wire when trace tool has 2+ points and a net', () => {
      let wireCreated = false;
      const params: TraceFinishParams = {
        circuitId: 1,
        activeLayer: 'front',
        traceWidth: 2.0,
        firstNetId: 5,
        createWire: () => { wireCreated = true; },
      };
      const points = [{ x: 10, y: 10 }, { x: 50, y: 50 }];
      let cleared = false;
      handleDoubleClick('trace', points, params, () => { cleared = true; });
      expect(wireCreated).toBe(true);
      expect(cleared).toBe(true);
    });

    it('does not create wire with fewer than 2 points', () => {
      let wireCreated = false;
      const params: TraceFinishParams = {
        circuitId: 1,
        activeLayer: 'front',
        traceWidth: 2.0,
        firstNetId: 5,
        createWire: () => { wireCreated = true; },
      };
      handleDoubleClick('trace', [{ x: 10, y: 10 }], params, () => undefined);
      expect(wireCreated).toBe(false);
    });

    it('does not create wire when firstNetId is undefined', () => {
      let wireCreated = false;
      const params: TraceFinishParams = {
        circuitId: 1,
        activeLayer: 'front',
        traceWidth: 2.0,
        firstNetId: undefined,
        createWire: () => { wireCreated = true; },
      };
      handleDoubleClick('trace', [{ x: 10, y: 10 }, { x: 50, y: 50 }], params, () => undefined);
      expect(wireCreated).toBe(false);
    });

    it('does not create wire when tool is not trace', () => {
      let wireCreated = false;
      const params: TraceFinishParams = {
        circuitId: 1,
        activeLayer: 'front',
        traceWidth: 2.0,
        firstNetId: 5,
        createWire: () => { wireCreated = true; },
      };
      handleDoubleClick('select', [{ x: 10, y: 10 }, { x: 50, y: 50 }], params, () => undefined);
      expect(wireCreated).toBe(false);
    });

    it('passes correct layer color in createWire call', () => {
      let receivedColor = '';
      const params: TraceFinishParams = {
        circuitId: 1,
        activeLayer: 'back',
        traceWidth: 1.0,
        firstNetId: 3,
        createWire: (p) => { receivedColor = p.color; },
      };
      handleDoubleClick('trace', [{ x: 0, y: 0 }, { x: 10, y: 10 }], params, () => undefined);
      expect(receivedColor).toBe(TRACE_COLORS.back);
    });
  });

  describe('handleKeyDown', () => {
    it('Escape clears trace points and selection', () => {
      let traceCalled = false;
      let instanceCleared = false;
      let wireCleared = false;
      const cbs = makeCallbacks({
        setTracePoints: () => { traceCalled = true; },
        setSelectedInstanceId: () => { instanceCleared = true; },
        setSelectedWireId: () => { wireCleared = true; },
      });
      const delParams: DeleteParams = { circuitId: 1, deleteWire: () => undefined };
      handleKeyDown(makeKeyEvent('Escape'), null, delParams, cbs);
      expect(traceCalled).toBe(true);
      expect(instanceCleared).toBe(true);
      expect(wireCleared).toBe(true);
    });

    it('Delete key deletes selected wire', () => {
      let deletedId: number | null = null;
      const delParams: DeleteParams = {
        circuitId: 1,
        deleteWire: (p) => { deletedId = p.id; },
      };
      handleKeyDown(makeKeyEvent('Delete'), 42, delParams, makeCallbacks());
      expect(deletedId).toBe(42);
    });

    it('Backspace key deletes selected wire', () => {
      let deletedId: number | null = null;
      const delParams: DeleteParams = {
        circuitId: 1,
        deleteWire: (p) => { deletedId = p.id; },
      };
      handleKeyDown(makeKeyEvent('Backspace'), 7, delParams, makeCallbacks());
      expect(deletedId).toBe(7);
    });

    it('Delete does nothing when no wire is selected', () => {
      let deleteCalled = false;
      const delParams: DeleteParams = {
        circuitId: 1,
        deleteWire: () => { deleteCalled = true; },
      };
      handleKeyDown(makeKeyEvent('Delete'), null, delParams, makeCallbacks());
      expect(deleteCalled).toBe(false);
    });

    it('number keys switch tools', () => {
      const toolSet: string[] = [];
      const cbs = makeCallbacks({ setTool: (t) => { toolSet.push(t); } });
      const delParams: DeleteParams = { circuitId: 1, deleteWire: () => undefined };
      handleKeyDown(makeKeyEvent('1'), null, delParams, cbs);
      handleKeyDown(makeKeyEvent('2'), null, delParams, cbs);
      handleKeyDown(makeKeyEvent('3'), null, delParams, cbs);
      expect(toolSet).toEqual(['select', 'trace', 'delete']);
    });

    it('f key toggles active layer', () => {
      let layerToggled = false;
      const cbs = makeCallbacks({ setActiveLayer: () => { layerToggled = true; } });
      const delParams: DeleteParams = { circuitId: 1, deleteWire: () => undefined };
      handleKeyDown(makeKeyEvent('f'), null, delParams, cbs);
      expect(layerToggled).toBe(true);
    });
  });

  describe('handleMouseDown', () => {
    it('starts panning on middle mouse button', () => {
      const panState: PanState = { isPanning: false, lastMouse: { x: 0, y: 0 } };
      handleMouseDown(makeMouseEvent({ button: 1, clientX: 50, clientY: 60 }), 'select', null, panState);
      expect(panState.isPanning).toBe(true);
      expect(panState.lastMouse).toEqual({ x: 50, y: 60 });
    });

    it('starts panning on left click with select tool and no selection', () => {
      const panState: PanState = { isPanning: false, lastMouse: { x: 0, y: 0 } };
      handleMouseDown(makeMouseEvent({ button: 0, clientX: 30, clientY: 40 }), 'select', null, panState);
      expect(panState.isPanning).toBe(true);
    });

    it('does not start panning when an instance is selected with select tool', () => {
      const panState: PanState = { isPanning: false, lastMouse: { x: 0, y: 0 } };
      handleMouseDown(makeMouseEvent({ button: 0 }), 'select', 5, panState);
      expect(panState.isPanning).toBe(false);
    });
  });

  describe('handleMouseUp', () => {
    it('stops panning', () => {
      const panState: PanState = { isPanning: true, lastMouse: { x: 50, y: 60 } };
      handleMouseUp(panState);
      expect(panState.isPanning).toBe(false);
    });
  });
});
