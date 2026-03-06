import { describe, it, expect } from 'vitest';
import { MazeRouter } from '@/lib/pcb/maze-router';
import { TraceRouter } from '@/lib/pcb/trace-router';
import { ViaModel } from '@/lib/pcb/via-model';
import { PCBDrcChecker } from '@/lib/pcb/pcb-drc-checker';
import {
  toggleLayer,
  nextLayer,
  getTraceColor,
  layerLabel,
} from '@/components/views/pcb-layout/LayerManager';
import {
  getLayerIndex,
  getLayerName,
  getCopperLayers,
  isOuterLayer,
  normalizeLegacyLayer,
} from '@/lib/pcb/layer-utils';

// ---------------------------------------------------------------------------
// LayerManager multi-layer extensions
// ---------------------------------------------------------------------------

describe('LayerManager — multi-layer', () => {
  describe('toggleLayer (2-layer)', () => {
    it('toggles front to B.Cu', () => {
      expect(toggleLayer('front')).toBe('B.Cu');
    });

    it('toggles back to F.Cu', () => {
      expect(toggleLayer('back')).toBe('F.Cu');
    });

    it('toggles F.Cu to B.Cu', () => {
      expect(toggleLayer('F.Cu')).toBe('B.Cu');
    });
  });

  describe('nextLayer (N-layer cycling)', () => {
    it('cycles through 2-layer board', () => {
      expect(nextLayer('F.Cu', 2)).toBe('B.Cu');
      expect(nextLayer('B.Cu', 2)).toBe('F.Cu');
    });

    it('cycles through 4-layer board', () => {
      expect(nextLayer('F.Cu', 4)).toBe('In1.Cu');
      expect(nextLayer('In1.Cu', 4)).toBe('In2.Cu');
      expect(nextLayer('In2.Cu', 4)).toBe('B.Cu');
      expect(nextLayer('B.Cu', 4)).toBe('F.Cu');
    });

    it('cycles with legacy names', () => {
      expect(nextLayer('front', 4)).toBe('In1.Cu');
      expect(nextLayer('back', 4)).toBe('F.Cu');
    });
  });

  describe('getTraceColor', () => {
    it('returns red for front layer', () => {
      expect(getTraceColor('front')).toBe('#e74c3c');
    });

    it('returns blue for back layer', () => {
      expect(getTraceColor('back')).toBe('#3498db');
    });

    it('returns color for inner layer on 4-layer board', () => {
      const color = getTraceColor('In1.Cu', 4);
      expect(color).toBeDefined();
      expect(color).not.toBe('#888888'); // not the fallback
    });

    it('returns fallback for unknown layer', () => {
      expect(getTraceColor('unknown_layer', 4)).toBe('#888888');
    });
  });

  describe('layerLabel', () => {
    it('returns human-readable label for front', () => {
      expect(layerLabel('front')).toBe('F.Cu (Front)');
      expect(layerLabel('F.Cu')).toBe('F.Cu (Front)');
    });

    it('returns human-readable label for back', () => {
      expect(layerLabel('back')).toBe('B.Cu (Back)');
      expect(layerLabel('B.Cu')).toBe('B.Cu (Back)');
    });

    it('returns the layer name for inner layers', () => {
      expect(layerLabel('In1.Cu')).toBe('In1.Cu');
      expect(layerLabel('In15.Cu')).toBe('In15.Cu');
    });
  });
});

// ---------------------------------------------------------------------------
// MazeRouter multi-layer
// ---------------------------------------------------------------------------

describe('MazeRouter — multi-layer', () => {
  it('initializes with default 2-layer grid', () => {
    const router = new MazeRouter();
    router.initGrid(10, 10);
    // Should work with 2-layer default
    expect(router.isBlocked(0, 0, 'front')).toBe(false);
    expect(router.isBlocked(0, 0, 'back')).toBe(false);
  });

  it('initializes with 4-layer grid', () => {
    const router = new MazeRouter({ layerCount: 4 });
    router.initGrid(10, 10);
    expect(router.isBlocked(0, 0, 'front')).toBe(false);
    expect(router.isBlocked(0, 0, 'back')).toBe(false);
    expect(router.isBlocked(0, 0, 'In1.Cu')).toBe(false);
    expect(router.isBlocked(0, 0, 'In2.Cu')).toBe(false);
  });

  it('blocks obstacles on inner layers', () => {
    const router = new MazeRouter({ layerCount: 4 });
    router.initGrid(10, 10);
    router.addObstacle({ x: 2, y: 2, width: 1, height: 1, layer: 'In1.Cu' });
    const gx = router.mmToGrid(2.5);
    const gy = router.mmToGrid(2.5);
    expect(router.isBlocked(gx, gy, 'In1.Cu')).toBe(true);
    expect(router.isBlocked(gx, gy, 'front')).toBe(false);
  });

  it('routes a net on a 4-layer board (same layer)', () => {
    const router = new MazeRouter({ layerCount: 4, gridSizeMm: 0.5 });
    router.initGrid(20, 20);
    const result = router.routeNet({
      netId: 'net1',
      sourcePad: { x: 1, y: 1, layer: 'front' },
      targetPad: { x: 5, y: 1, layer: 'front' },
      traceWidth: 0.25,
      clearance: 0.2,
    });
    expect(result).not.toBeNull();
    expect(result!.netId).toBe('net1');
    expect(result!.points.length).toBeGreaterThanOrEqual(2);
  });

  it('routes with layer change via on multi-layer board', () => {
    const router = new MazeRouter({ layerCount: 4, gridSizeMm: 0.5 });
    router.initGrid(20, 20);
    const result = router.routeNet({
      netId: 'net2',
      sourcePad: { x: 1, y: 1, layer: 'front' },
      targetPad: { x: 5, y: 5, layer: 'back' },
      traceWidth: 0.25,
      clearance: 0.2,
    });
    expect(result).not.toBeNull();
    expect(result!.vias.length).toBeGreaterThanOrEqual(1);
  });

  it('rip-up checks all layers for conflicts', () => {
    const router = new MazeRouter({ layerCount: 4, gridSizeMm: 0.5 });
    router.initGrid(20, 20);
    // Route multiple nets to test rip-up
    const requests = [
      {
        netId: 'net-a',
        sourcePad: { x: 1, y: 5, layer: 'front' },
        targetPad: { x: 19, y: 5, layer: 'front' },
        traceWidth: 0.25,
        clearance: 0.2,
        priority: 0,
      },
      {
        netId: 'net-b',
        sourcePad: { x: 10, y: 1, layer: 'front' },
        targetPad: { x: 10, y: 19, layer: 'front' },
        traceWidth: 0.25,
        clearance: 0.2,
        priority: 1,
      },
    ];
    const result = router.routeWithRipUp(requests, 3);
    // Both should route (possibly on different layers via rip-up)
    expect(result.stats.routedCount).toBeGreaterThanOrEqual(1);
  });

  it('routeAll works with layerCount parameter', () => {
    const router = new MazeRouter({ layerCount: 4, gridSizeMm: 0.5 });
    router.initGrid(20, 20);
    const result = router.routeAll([
      {
        netId: 'n1',
        sourcePad: { x: 1, y: 1, layer: 'front' },
        targetPad: { x: 5, y: 5, layer: 'front' },
        traceWidth: 0.25,
        clearance: 0.2,
      },
    ]);
    expect(result.stats.routedCount).toBe(1);
  });
});

// ---------------------------------------------------------------------------
// TraceRouter multi-layer
// ---------------------------------------------------------------------------

describe('TraceRouter — multi-layer', () => {
  it('starts trace on an inner layer', () => {
    const router = new TraceRouter();
    router.startTrace({ x: 5, y: 5 }, 'In1.Cu', 'net-inner');
    expect(router.isRouting()).toBe(true);
    expect(router.getCurrentLayer()).toBe('In1.Cu');
  });

  it('finishes trace on inner layer and returns correct layer in wires', () => {
    const router = new TraceRouter();
    router.startTrace({ x: 0, y: 0 }, 'In2.Cu', 'net-x');
    router.updatePreview({ x: 10, y: 0 });
    const result = router.finishTrace({ x: 10, y: 0 });
    expect(result.wires.length).toBeGreaterThanOrEqual(1);
    expect(result.wires[0].layer).toBe('In2.Cu');
  });

  it('via insertion toggles to opposite layer for 2-layer (legacy)', () => {
    const router = new TraceRouter();
    router.startTrace({ x: 0, y: 0 }, 'front', 'net-via');
    router.updatePreview({ x: 5, y: 0 });
    router.addVertex();
    const via = router.insertVia();
    expect(via.fromLayer).toBe('front');
    expect(via.toLayer).toBe('back');
    expect(router.getCurrentLayer()).toBe('back');
  });
});

// ---------------------------------------------------------------------------
// ViaModel multi-layer
// ---------------------------------------------------------------------------

describe('ViaModel — multi-layer', () => {
  describe('getOppositeLayer', () => {
    it('returns back for front', () => {
      expect(ViaModel.getOppositeLayer('front')).toBe('back');
    });

    it('returns front for back', () => {
      expect(ViaModel.getOppositeLayer('back')).toBe('front');
    });

    it('returns self for unknown layer', () => {
      expect(ViaModel.getOppositeLayer('unknown')).toBe('unknown');
    });
  });

  describe('getOppositeLayerMulti', () => {
    it('returns B.Cu for F.Cu on 4-layer board', () => {
      expect(ViaModel.getOppositeLayerMulti('F.Cu', 4)).toBe('B.Cu');
    });

    it('returns F.Cu for B.Cu on 4-layer board', () => {
      expect(ViaModel.getOppositeLayerMulti('B.Cu', 4)).toBe('F.Cu');
    });

    it('returns next layer for inner layers', () => {
      expect(ViaModel.getOppositeLayerMulti('In1.Cu', 4)).toBe('In2.Cu');
    });

    it('handles legacy names', () => {
      expect(ViaModel.getOppositeLayerMulti('front', 4)).toBe('B.Cu');
      expect(ViaModel.getOppositeLayerMulti('back', 4)).toBe('F.Cu');
    });
  });

  describe('classifyViaType', () => {
    it('classifies through via (outer to outer)', () => {
      expect(ViaModel.classifyViaType('F.Cu', 'B.Cu', 4)).toBe('through');
    });

    it('classifies blind via (outer to inner)', () => {
      expect(ViaModel.classifyViaType('F.Cu', 'In1.Cu', 4)).toBe('blind');
      expect(ViaModel.classifyViaType('B.Cu', 'In2.Cu', 4)).toBe('blind');
    });

    it('classifies buried via (inner to inner)', () => {
      expect(ViaModel.classifyViaType('In1.Cu', 'In2.Cu', 4)).toBe('buried');
    });

    it('classifies micro via (adjacent layers, 1-2 span)', () => {
      expect(ViaModel.classifyViaType('F.Cu', 'In1.Cu', 6)).toBe('blind');
      // Micro via is a subtype of blind — must span exactly 1 adjacent layer
    });

    it('classifies through via for 2-layer boards', () => {
      expect(ViaModel.classifyViaType('F.Cu', 'B.Cu', 2)).toBe('through');
      expect(ViaModel.classifyViaType('front', 'back', 2)).toBe('through');
    });
  });

  describe('validate with multi-layer', () => {
    it('validates a through via normally', () => {
      const via = ViaModel.create({ x: 10, y: 10 }, { fromLayer: 'F.Cu', toLayer: 'B.Cu' });
      const result = ViaModel.validate(via);
      expect(result.valid).toBe(true);
    });

    it('rejects blind via when rules disallow', () => {
      const via = ViaModel.create({ x: 10, y: 10 }, {
        type: 'blind',
        fromLayer: 'F.Cu',
        toLayer: 'In1.Cu',
      });
      const result = ViaModel.validate(via, { ...ViaModel.getDefaultRules(), allowBlind: false });
      expect(result.valid).toBe(false);
      expect(result.violations).toContain('Blind vias are not allowed by current design rules');
    });

    it('rejects buried via when rules disallow', () => {
      const via = ViaModel.create({ x: 10, y: 10 }, {
        type: 'buried',
        fromLayer: 'In1.Cu',
        toLayer: 'In2.Cu',
      });
      const result = ViaModel.validate(via, { ...ViaModel.getDefaultRules(), allowBuried: false });
      expect(result.valid).toBe(false);
    });
  });
});

// ---------------------------------------------------------------------------
// PCBDrcChecker — layer-aware checks (via pcb-drc-checker)
// ---------------------------------------------------------------------------

describe('DRC layer awareness', () => {
  it('traces on different layers should not violate clearance', () => {
    // This is implicit: the layersOverlap() function in pcb-drc-checker already
    // handles this. We verify the concept works for inner layers too.
    const checker = new PCBDrcChecker(0.2);

    // Add trace on In1.Cu
    checker.addObstacle({
      id: 'trace-inner1',
      type: 'trace',
      layer: 'In1.Cu',
      netId: 'net-a',
      geometry: { kind: 'segment', x1: 0, y1: 5, x2: 20, y2: 5, width: 0.25 },
    });

    // Check a trace on In2.Cu at same position — should NOT violate (different layer)
    const violations = checker.checkTrace(
      [{ x: 0, y: 5 }, { x: 20, y: 5 }],
      0.25,
      'In2.Cu',
      'net-b',
    );
    expect(violations.filter((v: { type: string }) => v.type === 'trace-trace')).toHaveLength(0);
  });

  it('traces on same inner layer should violate clearance when too close', () => {
    const checker = new PCBDrcChecker(0.2);

    checker.addObstacle({
      id: 'trace-inner1',
      type: 'trace',
      layer: 'In1.Cu',
      netId: 'net-a',
      geometry: { kind: 'segment', x1: 0, y1: 5, x2: 20, y2: 5, width: 0.25 },
    });

    // Check a trace on SAME layer (In1.Cu) very close — should violate
    const violations = checker.checkTrace(
      [{ x: 0, y: 5.1 }, { x: 20, y: 5.1 }],
      0.25,
      'In1.Cu',
      'net-b',
    );
    expect(violations.length).toBeGreaterThan(0);
  });

  it('"all" layer obstacles conflict with any layer', () => {
    const checker = new PCBDrcChecker(0.2);

    checker.addObstacle({
      id: 'via-1',
      type: 'via',
      layer: 'all',
      netId: 'net-via',
      geometry: { kind: 'circle', cx: 10, cy: 10, radius: 0.3 },
    });

    // Trace on In3.Cu close to via — should violate (via is 'all' layers)
    const violations = checker.checkTrace(
      [{ x: 10, y: 10.2 }, { x: 15, y: 10.2 }],
      0.25,
      'In3.Cu',
      'net-other',
    );
    expect(violations.length).toBeGreaterThan(0);
  });
});

// ---------------------------------------------------------------------------
// Integration: layer-utils with LayerManager
// ---------------------------------------------------------------------------

describe('layer-utils integration', () => {
  it('getLayerIndex and getLayerName are inverse operations', () => {
    for (let count = 2; count <= 8; count += 2) {
      const layers = getCopperLayers(count);
      for (let i = 0; i < layers.length; i++) {
        expect(getLayerIndex(layers[i], count)).toBe(i);
        expect(getLayerName(i, count)).toBe(layers[i]);
      }
    }
  });

  it('normalizeLegacyLayer with getLayerIndex gives correct results', () => {
    expect(getLayerIndex(normalizeLegacyLayer('front'), 4)).toBe(0);
    expect(getLayerIndex(normalizeLegacyLayer('back'), 4)).toBe(3);
  });

  it('isOuterLayer matches first and last getCopperLayers entries', () => {
    for (const count of [2, 4, 6, 8, 16, 32]) {
      const layers = getCopperLayers(count);
      expect(isOuterLayer(layers[0], count)).toBe(true);
      expect(isOuterLayer(layers[layers.length - 1], count)).toBe(true);
      if (layers.length > 2) {
        expect(isOuterLayer(layers[1], count)).toBe(false);
      }
    }
  });
});
