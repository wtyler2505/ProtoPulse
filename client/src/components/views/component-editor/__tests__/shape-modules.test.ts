/**
 * Tests for ShapeCanvas / Component Editor extracted pure-logic modules.
 *
 * Covers:
 *   - PathEditor: SVG path parsing, serialization, simplification, bounds, node toggling
 *   - HitTester: Marquee box selection
 *   - CanvasTransforms: screen-to-part-space, wheel zoom, zoom-to-fit
 *   - SnapGuideEngine: grid snapping
 *   - DragManager: drag origin construction
 */

import { describe, it, expect } from 'vitest';
import {
  pathDToNodes,
  nodesToPathD,
  simplifyPath,
  computeNodesBounds,
  computePathPointsBounds,
  pathPointsToNodes,
  toggleNodeType,
} from '../PathEditor';
import type { PathNode, PathPoint } from '../PathEditor';
import { shapesInMarquee } from '../HitTester';
import {
  screenToPartSpace,
  computeWheelZoom,
  computeZoomToFit,
  MIN_ZOOM,
  MAX_ZOOM,
  GRID_SIZE,
} from '../CanvasTransforms';
import { snapToGrid, snapPointToGrid } from '../SnapGuideEngine';
import { buildDragOrigins } from '../DragManager';
import type { Shape, RectShape } from '@shared/component-types';

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

function makeRect(id: string, x: number, y: number, w: number, h: number): RectShape {
  return { id, type: 'rect', x, y, width: w, height: h, rotation: 0 };
}

// ============================================================================
// PathEditor
// ============================================================================

describe('PathEditor', () => {
  describe('pathDToNodes', () => {
    it('parses absolute M and L commands', () => {
      const nodes = pathDToNodes('M 10 20 L 30 40 L 50 60');
      expect(nodes).toHaveLength(3);
      expect(nodes[0]).toEqual({ x: 10, y: 20, type: 'M' });
      expect(nodes[1]).toEqual({ x: 30, y: 40, type: 'L' });
      expect(nodes[2]).toEqual({ x: 50, y: 60, type: 'L' });
    });

    it('parses relative m and l commands', () => {
      const nodes = pathDToNodes('m 10 20 l 5 5 l 10 10');
      expect(nodes).toHaveLength(3);
      expect(nodes[0]).toEqual({ x: 10, y: 20, type: 'M' });
      expect(nodes[1]).toEqual({ x: 15, y: 25, type: 'L' });
      expect(nodes[2]).toEqual({ x: 25, y: 35, type: 'L' });
    });

    it('parses absolute C (cubic bezier) command', () => {
      const nodes = pathDToNodes('M 0 0 C 10 20 30 40 50 60');
      expect(nodes).toHaveLength(2);
      expect(nodes[1].type).toBe('C');
      expect(nodes[1].cp1).toEqual({ x: 10, y: 20 });
      expect(nodes[1].cp2).toEqual({ x: 30, y: 40 });
      expect(nodes[1].x).toBe(50);
      expect(nodes[1].y).toBe(60);
    });

    it('parses relative c command with correct offset', () => {
      const nodes = pathDToNodes('M 100 100 c 10 20 30 40 50 60');
      expect(nodes[1].x).toBe(150);
      expect(nodes[1].y).toBe(160);
      expect(nodes[1].cp1).toEqual({ x: 110, y: 120 });
      expect(nodes[1].cp2).toEqual({ x: 130, y: 140 });
    });

    it('parses absolute Q (quadratic bezier) command', () => {
      const nodes = pathDToNodes('M 0 0 Q 25 50 50 0');
      expect(nodes).toHaveLength(2);
      expect(nodes[1].type).toBe('Q');
      expect(nodes[1].cp1).toEqual({ x: 25, y: 50 });
      expect(nodes[1].x).toBe(50);
      expect(nodes[1].y).toBe(0);
    });

    it('parses relative q command', () => {
      const nodes = pathDToNodes('M 10 10 q 5 10 20 0');
      expect(nodes[1].x).toBe(30);
      expect(nodes[1].y).toBe(10);
      expect(nodes[1].cp1).toEqual({ x: 15, y: 20 });
    });

    it('parses S (smooth cubic) command', () => {
      const nodes = pathDToNodes('M 0 0 S 10 20 30 40');
      expect(nodes).toHaveLength(2);
      expect(nodes[1].type).toBe('C');
      expect(nodes[1].cp2).toEqual({ x: 10, y: 20 });
      expect(nodes[1].x).toBe(30);
      expect(nodes[1].y).toBe(40);
    });

    it('parses T (smooth quadratic) command', () => {
      const nodes = pathDToNodes('M 0 0 T 50 50');
      expect(nodes).toHaveLength(2);
      expect(nodes[1].type).toBe('Q');
      expect(nodes[1].x).toBe(50);
      expect(nodes[1].y).toBe(50);
    });

    it('handles Z (closepath) without crashing', () => {
      const nodes = pathDToNodes('M 0 0 L 10 0 L 10 10 Z');
      expect(nodes).toHaveLength(3);
    });

    it('returns empty array for empty string', () => {
      expect(pathDToNodes('')).toEqual([]);
    });

    it('handles negative coordinates', () => {
      const nodes = pathDToNodes('M -10 -20 L -30 -40');
      expect(nodes[0]).toEqual({ x: -10, y: -20, type: 'M' });
      expect(nodes[1]).toEqual({ x: -30, y: -40, type: 'L' });
    });

    it('handles decimal coordinates', () => {
      const nodes = pathDToNodes('M 1.5 2.7 L 3.14 4.99');
      expect(nodes[0].x).toBeCloseTo(1.5);
      expect(nodes[0].y).toBeCloseTo(2.7);
    });
  });

  describe('nodesToPathD', () => {
    it('serializes M and L nodes', () => {
      const nodes: PathNode[] = [
        { x: 10, y: 20, type: 'M' },
        { x: 30, y: 40, type: 'L' },
      ];
      expect(nodesToPathD(nodes)).toBe('M 10 20 L 30 40');
    });

    it('serializes C node with control points', () => {
      const nodes: PathNode[] = [
        { x: 0, y: 0, type: 'M' },
        { x: 50, y: 60, type: 'C', cp1: { x: 10, y: 20 }, cp2: { x: 30, y: 40 } },
      ];
      const d = nodesToPathD(nodes);
      expect(d).toBe('M 0 0 C 10 20 30 40 50 60');
    });

    it('serializes Q node with control point', () => {
      const nodes: PathNode[] = [
        { x: 0, y: 0, type: 'M' },
        { x: 50, y: 0, type: 'Q', cp1: { x: 25, y: 50 } },
      ];
      const d = nodesToPathD(nodes);
      expect(d).toBe('M 0 0 Q 25 50 50 0');
    });

    it('falls back to node position when control points are missing on C', () => {
      const nodes: PathNode[] = [
        { x: 0, y: 0, type: 'M' },
        { x: 50, y: 60, type: 'C' },
      ];
      const d = nodesToPathD(nodes);
      expect(d).toBe('M 0 0 C 50 60 50 60 50 60');
    });

    it('round-trips a simple path', () => {
      const original = 'M 10 20 L 30 40 L 50 60';
      const nodes = pathDToNodes(original);
      const serialized = nodesToPathD(nodes);
      expect(serialized).toBe(original);
    });
  });

  describe('simplifyPath', () => {
    it('returns nodes unchanged when length <= 2', () => {
      const nodes: PathNode[] = [
        { x: 0, y: 0, type: 'M' },
        { x: 100, y: 100, type: 'L' },
      ];
      const result = simplifyPath(nodes, 5);
      expect(result).toHaveLength(2);
    });

    it('removes collinear intermediate points', () => {
      // Three points on a line: (0,0) -> (50,50) -> (100,100)
      const nodes: PathNode[] = [
        { x: 0, y: 0, type: 'M' },
        { x: 50, y: 50, type: 'L' },
        { x: 100, y: 100, type: 'L' },
      ];
      const result = simplifyPath(nodes, 1);
      // Middle point is collinear, so it should be removed
      expect(result).toHaveLength(2);
      expect(result[0].x).toBe(0);
      expect(result[1].x).toBe(100);
    });

    it('keeps points that deviate beyond tolerance', () => {
      const nodes: PathNode[] = [
        { x: 0, y: 0, type: 'M' },
        { x: 50, y: 50, type: 'L' }, // deviates from line (0,0)-(100,0) by 50 units
        { x: 100, y: 0, type: 'L' },
      ];
      const result = simplifyPath(nodes, 5);
      expect(result).toHaveLength(3);
    });

    it('preserves start and end points', () => {
      const nodes: PathNode[] = [
        { x: 5, y: 10, type: 'M' },
        { x: 50, y: 50, type: 'L' },
        { x: 100, y: 0, type: 'L' },
        { x: 200, y: 200, type: 'L' },
      ];
      const result = simplifyPath(nodes, 100);
      expect(result[0].x).toBe(5);
      expect(result[result.length - 1].x).toBe(200);
    });

    it('does not mutate original nodes', () => {
      const nodes: PathNode[] = [
        { x: 0, y: 0, type: 'M' },
        { x: 50, y: 50, type: 'L' },
        { x: 100, y: 100, type: 'L' },
      ];
      const copy = JSON.parse(JSON.stringify(nodes)) as PathNode[];
      simplifyPath(nodes, 1);
      expect(nodes).toEqual(copy);
    });

    it('handles multiple segments (multiple M commands)', () => {
      const nodes: PathNode[] = [
        { x: 0, y: 0, type: 'M' },
        { x: 100, y: 100, type: 'L' },
        { x: 200, y: 0, type: 'M' },
        { x: 300, y: 100, type: 'L' },
      ];
      const result = simplifyPath(nodes, 1);
      expect(result).toHaveLength(4); // 2 per segment
    });
  });

  describe('computeNodesBounds', () => {
    it('computes bounds for simple line nodes', () => {
      const nodes: PathNode[] = [
        { x: 10, y: 20, type: 'M' },
        { x: 50, y: 80, type: 'L' },
      ];
      const bounds = computeNodesBounds(nodes);
      expect(bounds).toEqual({ minX: 10, minY: 20, maxX: 50, maxY: 80 });
    });

    it('includes control points in bounds', () => {
      const nodes: PathNode[] = [
        { x: 0, y: 0, type: 'M' },
        { x: 100, y: 100, type: 'C', cp1: { x: -50, y: 200 }, cp2: { x: 150, y: -30 } },
      ];
      const bounds = computeNodesBounds(nodes);
      expect(bounds.minX).toBe(-50);
      expect(bounds.maxY).toBe(200);
      expect(bounds.maxX).toBe(150);
      expect(bounds.minY).toBe(-30);
    });

    it('returns Infinity/-Infinity for empty nodes', () => {
      const bounds = computeNodesBounds([]);
      expect(bounds.minX).toBe(Infinity);
      expect(bounds.maxX).toBe(-Infinity);
    });
  });

  describe('computePathPointsBounds', () => {
    it('computes bounds for path points', () => {
      const points: PathPoint[] = [
        { x: 5, y: 15 },
        { x: 95, y: 85 },
      ];
      const bounds = computePathPointsBounds(points);
      expect(bounds).toEqual({ minX: 5, minY: 15, maxX: 95, maxY: 85 });
    });

    it('includes control points', () => {
      const points: PathPoint[] = [
        { x: 0, y: 0 },
        { x: 50, y: 50, cp1: { x: -20, y: 100 } },
      ];
      const bounds = computePathPointsBounds(points);
      expect(bounds.minX).toBe(-20);
      expect(bounds.maxY).toBe(100);
    });
  });

  describe('pathPointsToNodes', () => {
    it('first point becomes M node', () => {
      const points: PathPoint[] = [{ x: 10, y: 20 }, { x: 30, y: 40 }];
      const nodes = pathPointsToNodes(points);
      expect(nodes[0].type).toBe('M');
      expect(nodes[0].x).toBe(10);
    });

    it('plain subsequent points become L nodes', () => {
      const points: PathPoint[] = [{ x: 0, y: 0 }, { x: 10, y: 10 }, { x: 20, y: 20 }];
      const nodes = pathPointsToNodes(points);
      expect(nodes[1].type).toBe('L');
      expect(nodes[2].type).toBe('L');
    });

    it('points with control points become C nodes', () => {
      const points: PathPoint[] = [
        { x: 0, y: 0 },
        { x: 50, y: 50, cp1: { x: 10, y: 20 }, cp2: { x: 30, y: 40 } },
      ];
      const nodes = pathPointsToNodes(points);
      expect(nodes[1].type).toBe('C');
      expect(nodes[1].cp1).toEqual({ x: 10, y: 20 });
      expect(nodes[1].cp2).toEqual({ x: 30, y: 40 });
    });

    it('uses fallback control points when only cp1 is provided', () => {
      const points: PathPoint[] = [
        { x: 0, y: 0 },
        { x: 50, y: 50, cp1: { x: 10, y: 20 } },
      ];
      const nodes = pathPointsToNodes(points);
      expect(nodes[1].type).toBe('C');
      expect(nodes[1].cp2).toEqual({ x: 50, y: 50 }); // falls back to node position
    });
  });

  describe('toggleNodeType', () => {
    it('converts L node to C by adding control points', () => {
      const nodes: PathNode[] = [
        { x: 0, y: 0, type: 'M' },
        { x: 50, y: 50, type: 'L' },
        { x: 100, y: 0, type: 'L' },
      ];
      const result = toggleNodeType(nodes, 1);
      expect(result[1].type).toBe('C');
      expect(result[1].cp1).toBeDefined();
      expect(result[1].cp2).toBeDefined();
    });

    it('converts C node back to L by removing control points', () => {
      const nodes: PathNode[] = [
        { x: 0, y: 0, type: 'M' },
        { x: 50, y: 50, type: 'C', cp1: { x: 10, y: 20 }, cp2: { x: 40, y: 30 } },
        { x: 100, y: 0, type: 'L' },
      ];
      const result = toggleNodeType(nodes, 1);
      expect(result[1].type).toBe('L');
      expect(result[1].cp1).toBeUndefined();
      expect(result[1].cp2).toBeUndefined();
    });

    it('does not mutate original array', () => {
      const nodes: PathNode[] = [
        { x: 0, y: 0, type: 'M' },
        { x: 50, y: 50, type: 'L' },
      ];
      const originalType = nodes[1].type;
      toggleNodeType(nodes, 1);
      expect(nodes[1].type).toBe(originalType);
    });

    it('does not change M node type (only removes control points)', () => {
      const nodes: PathNode[] = [
        { x: 0, y: 0, type: 'M', cp1: { x: 5, y: 5 } },
        { x: 50, y: 50, type: 'L' },
      ];
      const result = toggleNodeType(nodes, 0);
      // M with control points: control points removed, type stays M
      expect(result[0].type).toBe('M');
      expect(result[0].cp1).toBeUndefined();
    });
  });
});

// ============================================================================
// HitTester
// ============================================================================

describe('HitTester', () => {
  describe('shapesInMarquee', () => {
    const shapes: Shape[] = [
      makeRect('a', 10, 10, 20, 20),
      makeRect('b', 50, 50, 20, 20),
      makeRect('c', 90, 10, 20, 20),
    ];

    it('selects shapes fully inside marquee', () => {
      const ids = shapesInMarquee(shapes, { x: 0, y: 0 }, { x: 120, y: 120 });
      expect(ids).toEqual(['a', 'b', 'c']);
    });

    it('selects shapes that partially overlap marquee', () => {
      // Marquee covers top-left corner, overlaps shape 'a' and 'c'
      const ids = shapesInMarquee(shapes, { x: 0, y: 0 }, { x: 100, y: 35 });
      expect(ids).toContain('a');
      expect(ids).toContain('c');
      expect(ids).not.toContain('b');
    });

    it('returns empty when marquee misses all shapes', () => {
      const ids = shapesInMarquee(shapes, { x: 200, y: 200 }, { x: 300, y: 300 });
      expect(ids).toEqual([]);
    });

    it('works when marquee is drawn right-to-left (reversed coords)', () => {
      // shapesInMarquee uses Math.min/max so reversed coords still work
      const ids = shapesInMarquee(shapes, { x: 120, y: 120 }, { x: 0, y: 0 });
      expect(ids).toEqual(['a', 'b', 'c']);
    });

    it('returns empty for zero-area marquee that misses shapes', () => {
      const ids = shapesInMarquee(shapes, { x: 0, y: 0 }, { x: 0, y: 0 });
      expect(ids).toEqual([]);
    });

    it('does not select shapes that are adjacent but not overlapping', () => {
      // Marquee ends exactly at shape a's left edge
      const ids = shapesInMarquee(shapes, { x: 0, y: 0 }, { x: 10, y: 10 });
      // x: 0..10, shape a is at x: 10..30 -> overlap check: 10 < 10? no
      expect(ids).toEqual([]);
    });

    it('handles empty shapes array', () => {
      const ids = shapesInMarquee([], { x: 0, y: 0 }, { x: 100, y: 100 });
      expect(ids).toEqual([]);
    });
  });
});

// ============================================================================
// CanvasTransforms
// ============================================================================

describe('CanvasTransforms', () => {
  describe('screenToPartSpace', () => {
    it('converts with identity transform (no pan, zoom=1)', () => {
      const result = screenToPartSpace(100, 50, makeSvgRect(), 0, 0, 1);
      expect(result).toEqual({ x: 100, y: 50 });
    });

    it('accounts for pan offset', () => {
      const result = screenToPartSpace(140, 80, makeSvgRect(), 40, 30, 1);
      expect(result).toEqual({ x: 100, y: 50 });
    });

    it('accounts for zoom', () => {
      const result = screenToPartSpace(200, 100, makeSvgRect(), 0, 0, 2);
      expect(result).toEqual({ x: 100, y: 50 });
    });

    it('accounts for SVG element offset', () => {
      const result = screenToPartSpace(110, 60, makeSvgRect(10, 10), 0, 0, 1);
      expect(result).toEqual({ x: 100, y: 50 });
    });
  });

  describe('computeWheelZoom', () => {
    it('zooms in on negative deltaY', () => {
      const result = computeWheelZoom(-100, 400, 300, makeSvgRect(), 1, 0, 0);
      expect(result.zoom).toBeGreaterThan(1);
    });

    it('zooms out on positive deltaY', () => {
      const result = computeWheelZoom(100, 400, 300, makeSvgRect(), 1, 0, 0);
      expect(result.zoom).toBeLessThan(1);
    });

    it('clamps zoom to MIN_ZOOM', () => {
      const result = computeWheelZoom(100, 400, 300, makeSvgRect(), MIN_ZOOM, 0, 0);
      expect(result.zoom).toBeGreaterThanOrEqual(MIN_ZOOM);
    });

    it('clamps zoom to MAX_ZOOM', () => {
      const result = computeWheelZoom(-100, 400, 300, makeSvgRect(), MAX_ZOOM, 0, 0);
      expect(result.zoom).toBeLessThanOrEqual(MAX_ZOOM);
    });

    it('adjusts pan to keep mouse position fixed', () => {
      const result = computeWheelZoom(-100, 400, 300, makeSvgRect(), 1, 0, 0);
      // The formula: panX = mx - (mx - currentPanX) * (nz / currentZoom)
      // mx = 400 - 0 = 400, nz = 1 * 1.1 = 1.1
      // panX = 400 - (400 - 0) * (1.1 / 1) = 400 - 440 = -40
      expect(result.panX).toBeCloseTo(-40);
    });
  });

  describe('computeZoomToFit', () => {
    it('returns default for empty shapes array', () => {
      const result = computeZoomToFit([], 800, 600);
      expect(result).toEqual({ zoom: 1, panX: 0, panY: 0 });
    });

    it('centers a single shape in the viewport', () => {
      const shapes: Shape[] = [makeRect('s1', 100, 100, 50, 50)];
      const result = computeZoomToFit(shapes, 800, 600);
      // Center of shapes: (125, 125)
      // panX = 800/2 - 125*zoom, panY = 600/2 - 125*zoom
      expect(result.zoom).toBeGreaterThan(0);
      expect(typeof result.panX).toBe('number');
      expect(typeof result.panY).toBe('number');
    });

    it('handles shapes with zero extent gracefully', () => {
      // A point-like shape (width=0, height=0)
      const shapes: Shape[] = [makeRect('s1', 50, 50, 0, 0)];
      const result = computeZoomToFit(shapes, 800, 600);
      expect(result).toEqual({ zoom: 1, panX: 0, panY: 0 });
    });

    it('clamps zoom to range', () => {
      // Very large shapes relative to viewport should not go below MIN_ZOOM
      const shapes: Shape[] = [makeRect('s1', 0, 0, 100000, 100000)];
      const result = computeZoomToFit(shapes, 100, 100);
      expect(result.zoom).toBeGreaterThanOrEqual(MIN_ZOOM);
    });
  });

  describe('constants', () => {
    it('has sensible zoom limits', () => {
      expect(MIN_ZOOM).toBe(0.1);
      expect(MAX_ZOOM).toBe(10);
    });

    it('has a positive grid size', () => {
      expect(GRID_SIZE).toBe(10);
    });
  });
});

// ============================================================================
// SnapGuideEngine
// ============================================================================

describe('SnapGuideEngine', () => {
  describe('snapToGrid', () => {
    it('snaps value to nearest grid point', () => {
      expect(snapToGrid(13, 10)).toBe(10);
      expect(snapToGrid(17, 10)).toBe(20);
    });

    it('snaps exact grid values to themselves', () => {
      expect(snapToGrid(30, 10)).toBe(30);
    });

    it('snaps midpoint to nearest (rounds up)', () => {
      expect(snapToGrid(15, 10)).toBe(20);
    });

    it('handles zero', () => {
      expect(snapToGrid(0, 10)).toBe(0);
    });

    it('handles negative values', () => {
      expect(snapToGrid(-13, 10)).toBe(-10);
      expect(snapToGrid(-17, 10)).toBe(-20);
    });
  });

  describe('snapPointToGrid', () => {
    it('snaps both x and y to grid', () => {
      const result = snapPointToGrid(13, 27, 10);
      expect(result).toEqual({ x: 10, y: 30 });
    });

    it('snaps exact grid positions to themselves', () => {
      const result = snapPointToGrid(20, 40, 10);
      expect(result).toEqual({ x: 20, y: 40 });
    });

    it('works with small grid size', () => {
      const result = snapPointToGrid(3.7, 6.2, 2.5);
      // 3.7 / 2.5 = 1.48 → rounds to 1 → 2.5
      expect(result.x).toBeCloseTo(2.5);
      // 6.2 / 2.5 = 2.48 → rounds to 2 → 5.0
      expect(result.y).toBeCloseTo(5.0);
    });
  });
});

// ============================================================================
// DragManager
// ============================================================================

describe('DragManager', () => {
  describe('buildDragOrigins', () => {
    const shapes: Shape[] = [
      makeRect('a', 10, 20, 30, 30),
      makeRect('b', 50, 60, 30, 30),
      makeRect('c', 90, 100, 30, 30),
    ];

    it('builds origins for a single click on an unselected shape', () => {
      const origins = buildDragOrigins(shapes, [], 'a', false);
      expect(origins.size).toBe(1);
      expect(origins.get('a')).toEqual({ x: 10, y: 20 });
    });

    it('keeps existing selection when clicking on a selected shape', () => {
      const origins = buildDragOrigins(shapes, ['a', 'b'], 'a', false);
      expect(origins.size).toBe(2);
      expect(origins.has('a')).toBe(true);
      expect(origins.has('b')).toBe(true);
    });

    it('replaces selection when clicking unselected without shift', () => {
      const origins = buildDragOrigins(shapes, ['b'], 'a', false);
      expect(origins.size).toBe(1);
      expect(origins.has('a')).toBe(true);
      expect(origins.has('b')).toBe(false);
    });

    it('adds to selection with shift-click on unselected', () => {
      const origins = buildDragOrigins(shapes, ['b'], 'a', true);
      expect(origins.size).toBe(2);
      expect(origins.has('a')).toBe(true);
      expect(origins.has('b')).toBe(true);
    });

    it('always includes clicked shape even when shift-toggled off selection', () => {
      const origins = buildDragOrigins(shapes, ['a', 'b'], 'a', true);
      // Shift-clicking 'a' removes it from the selection ids, but the function
      // always ensures the clicked shape is in origins (line 37-40 fallback).
      // So origins contains 'b' from selection + 'a' from fallback.
      expect(origins.size).toBe(2);
      expect(origins.has('b')).toBe(true);
      expect(origins.has('a')).toBe(true);
    });

    it('uses the correct origin coordinates from shapes', () => {
      const origins = buildDragOrigins(shapes, ['a', 'c'], 'a', false);
      expect(origins.get('a')).toEqual({ x: 10, y: 20 });
      expect(origins.get('c')).toEqual({ x: 90, y: 100 });
    });
  });
});
