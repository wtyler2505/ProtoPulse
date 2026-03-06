import { describe, it, expect, beforeEach } from 'vitest';
import {
  PCBDrcChecker,
  type PCBObstacle,
  type PCBDrcViolation,
  type ObstacleGeometry,
} from '../pcb/pcb-drc-checker';

describe('PCBDrcChecker', () => {
  let checker: PCBDrcChecker;

  beforeEach(() => {
    checker = new PCBDrcChecker();
  });

  // ---------------------------------------------------------------------------
  // Construction & Configuration
  // ---------------------------------------------------------------------------

  describe('construction and configuration', () => {
    it('creates with default clearance of 0.2mm', () => {
      const c = new PCBDrcChecker();
      expect(c).toBeDefined();
      // checkTrace on an empty board should return no violations
      expect(c.checkTrace([{ x: 0, y: 0 }, { x: 10, y: 0 }], 0.25, 'front')).toEqual([]);
    });

    it('creates with custom clearance', () => {
      const c = new PCBDrcChecker(0.5);
      expect(c).toBeDefined();
    });

    it('setClearance updates the default clearance', () => {
      checker.setClearance(0.5);
      // Two parallel traces at 0.3mm apart should violate with 0.5mm clearance
      const traceA: PCBObstacle = {
        id: 'trace-a',
        type: 'trace',
        layer: 'front',
        netId: 'net-1',
        geometry: { kind: 'segment', x1: 0, y1: 0, x2: 10, y2: 0, width: 0.2 },
      };
      checker.buildObstacleDB([traceA]);
      // Parallel trace 0.4mm away (center-to-center), width 0.2 => edge-to-edge = 0.2mm
      const violations = checker.checkTrace([{ x: 0, y: 0.4 }, { x: 10, y: 0.4 }], 0.2, 'front', 'net-2');
      expect(violations.length).toBeGreaterThan(0);
      expect(violations[0].type).toBe('trace-trace');
    });

    it('setMinTraceWidth configures minimum trace width', () => {
      checker.setMinTraceWidth(0.15);
      // Trace below min width
      const violations = checker.checkTrace([{ x: 0, y: 0 }, { x: 10, y: 0 }], 0.1, 'front');
      expect(violations.some((v) => v.type === 'min-width')).toBe(true);
    });

    it('setBoardEdgeClearance configures board edge clearance', () => {
      checker.setBoardEdgeClearance(1.0);
      const edge: PCBObstacle = {
        id: 'edge-1',
        type: 'edge',
        layer: 'all',
        geometry: { kind: 'line', x1: 0, y1: 0, x2: 0, y2: 100 },
      };
      checker.buildObstacleDB([edge]);
      // Trace 0.3mm from edge should violate with 1.0mm edge clearance
      const violations = checker.checkTrace([{ x: 0.3, y: 10 }, { x: 0.3, y: 90 }], 0.2, 'front');
      expect(violations.some((v) => v.type === 'trace-edge')).toBe(true);
    });
  });

  // ---------------------------------------------------------------------------
  // Obstacle Database Management
  // ---------------------------------------------------------------------------

  describe('obstacle database management', () => {
    it('buildObstacleDB populates spatial index from obstacle list', () => {
      const obstacles: PCBObstacle[] = [
        {
          id: 'pad-1',
          type: 'pad',
          layer: 'front',
          netId: 'net-1',
          geometry: { kind: 'circle', cx: 5, cy: 5, radius: 0.5 },
        },
        {
          id: 'pad-2',
          type: 'pad',
          layer: 'front',
          netId: 'net-2',
          geometry: { kind: 'circle', cx: 15, cy: 15, radius: 0.5 },
        },
      ];
      checker.buildObstacleDB(obstacles);
      // A trace near pad-2 but far from pad-1 should only detect pad-2
      const violations = checker.checkTrace(
        [{ x: 15, y: 15.6 }, { x: 20, y: 15.6 }],
        0.2,
        'front',
        'net-3',
      );
      // Should have a violation for pad-2 (center-to-center = 0.6, minus pad radius 0.5, minus trace half-width 0.1 = 0.0)
      expect(violations.length).toBeGreaterThan(0);
    });

    it('addObstacle adds a single obstacle to the index', () => {
      checker.addObstacle({
        id: 'via-1',
        type: 'via',
        layer: 'all',
        netId: 'net-1',
        geometry: { kind: 'circle', cx: 10, cy: 10, radius: 0.3 },
      });
      const violations = checker.checkTrace(
        [{ x: 10, y: 10.4 }, { x: 15, y: 10.4 }],
        0.2,
        'front',
        'net-2',
      );
      expect(violations.length).toBeGreaterThan(0);
    });

    it('removeObstacle removes an obstacle from the index', () => {
      const obstacle: PCBObstacle = {
        id: 'pad-1',
        type: 'pad',
        layer: 'front',
        netId: 'net-1',
        geometry: { kind: 'circle', cx: 5, cy: 5, radius: 0.5 },
      };
      checker.addObstacle(obstacle);
      // Verify it's detected
      let violations = checker.checkTrace(
        [{ x: 5, y: 5.6 }, { x: 10, y: 5.6 }],
        0.2,
        'front',
        'net-2',
      );
      expect(violations.length).toBeGreaterThan(0);

      // Remove and verify it's gone
      checker.removeObstacle('pad-1');
      violations = checker.checkTrace(
        [{ x: 5, y: 5.6 }, { x: 10, y: 5.6 }],
        0.2,
        'front',
        'net-2',
      );
      expect(violations.length).toBe(0);
    });

    it('clearObstacles removes all obstacles', () => {
      checker.buildObstacleDB([
        {
          id: 'pad-1',
          type: 'pad',
          layer: 'front',
          netId: 'net-1',
          geometry: { kind: 'circle', cx: 5, cy: 5, radius: 0.5 },
        },
        {
          id: 'pad-2',
          type: 'pad',
          layer: 'front',
          netId: 'net-2',
          geometry: { kind: 'circle', cx: 15, cy: 15, radius: 0.5 },
        },
      ]);
      checker.clearObstacles();
      // No violations on empty board
      const violations = checker.checkTrace(
        [{ x: 5, y: 5.6 }, { x: 10, y: 5.6 }],
        0.2,
        'front',
        'net-1',
      );
      expect(violations.length).toBe(0);
    });
  });

  // ---------------------------------------------------------------------------
  // Trace-to-Trace Clearance
  // ---------------------------------------------------------------------------

  describe('trace-to-trace clearance', () => {
    it('detects parallel traces too close together', () => {
      const existing: PCBObstacle = {
        id: 'trace-1',
        type: 'trace',
        layer: 'front',
        netId: 'net-1',
        geometry: { kind: 'segment', x1: 0, y1: 0, x2: 20, y2: 0, width: 0.25 },
      };
      checker.buildObstacleDB([existing]);
      // New trace 0.3mm center-to-center, width 0.25
      // Edge-to-edge = 0.3 - 0.125 - 0.125 = 0.05mm < 0.2mm clearance
      const violations = checker.checkTrace(
        [{ x: 0, y: 0.3 }, { x: 20, y: 0.3 }],
        0.25,
        'front',
        'net-2',
      );
      expect(violations.length).toBeGreaterThan(0);
      expect(violations[0].type).toBe('trace-trace');
      expect(violations[0].severity).toBe('error');
      expect(violations[0].clearanceActual).toBeLessThan(0.2);
    });

    it('passes when parallel traces have adequate spacing', () => {
      const existing: PCBObstacle = {
        id: 'trace-1',
        type: 'trace',
        layer: 'front',
        netId: 'net-1',
        geometry: { kind: 'segment', x1: 0, y1: 0, x2: 20, y2: 0, width: 0.25 },
      };
      checker.buildObstacleDB([existing]);
      // New trace 1mm center-to-center — plenty of room
      const violations = checker.checkTrace(
        [{ x: 0, y: 1 }, { x: 20, y: 1 }],
        0.25,
        'front',
        'net-2',
      );
      expect(violations.filter((v) => v.type === 'trace-trace').length).toBe(0);
    });

    it('detects perpendicular traces that cross too close', () => {
      const existing: PCBObstacle = {
        id: 'trace-h',
        type: 'trace',
        layer: 'front',
        netId: 'net-1',
        geometry: { kind: 'segment', x1: 0, y1: 5, x2: 20, y2: 5, width: 0.25 },
      };
      checker.buildObstacleDB([existing]);
      // Vertical trace passing near the horizontal trace, different net
      // At y=5 center-to-center distance is 0 — they cross
      const violations = checker.checkTrace(
        [{ x: 10, y: 0 }, { x: 10, y: 10 }],
        0.25,
        'front',
        'net-2',
      );
      expect(violations.some((v) => v.type === 'trace-trace')).toBe(true);
    });
  });

  // ---------------------------------------------------------------------------
  // Trace-to-Pad Clearance
  // ---------------------------------------------------------------------------

  describe('trace-to-pad clearance', () => {
    it('detects trace too close to a pad', () => {
      const pad: PCBObstacle = {
        id: 'pad-1',
        type: 'pad',
        layer: 'front',
        netId: 'net-1',
        geometry: { kind: 'circle', cx: 10, cy: 10, radius: 0.5 },
      };
      checker.buildObstacleDB([pad]);
      // Trace passing 0.55mm from pad center, width 0.2
      // Edge distance = 0.55 - 0.5 (pad radius) - 0.1 (trace half-width) = -0.05mm
      const violations = checker.checkTrace(
        [{ x: 0, y: 10.55 }, { x: 20, y: 10.55 }],
        0.2,
        'front',
        'net-2',
      );
      expect(violations.some((v) => v.type === 'trace-pad')).toBe(true);
    });

    it('no violation when trace connects to its own pad (same net)', () => {
      const pad: PCBObstacle = {
        id: 'pad-1',
        type: 'pad',
        layer: 'front',
        netId: 'net-1',
        geometry: { kind: 'circle', cx: 10, cy: 10, radius: 0.5 },
      };
      checker.buildObstacleDB([pad]);
      // Trace going right through the pad — same net, no violation
      const violations = checker.checkTrace(
        [{ x: 5, y: 10 }, { x: 15, y: 10 }],
        0.25,
        'front',
        'net-1',
      );
      expect(violations.filter((v) => v.type === 'trace-pad').length).toBe(0);
    });

    it('detects trace too close to a rectangular pad', () => {
      const pad: PCBObstacle = {
        id: 'smd-1',
        type: 'pad',
        layer: 'front',
        netId: 'net-1',
        geometry: { kind: 'rect', x: 9, y: 9.5, width: 2, height: 1 },
      };
      checker.buildObstacleDB([pad]);
      // Trace just above the rect pad, edge-to-edge < 0.2mm
      const violations = checker.checkTrace(
        [{ x: 5, y: 10.6 }, { x: 15, y: 10.6 }],
        0.2,
        'front',
        'net-2',
      );
      expect(violations.some((v) => v.type === 'trace-pad')).toBe(true);
    });
  });

  // ---------------------------------------------------------------------------
  // Trace-to-Via Clearance
  // ---------------------------------------------------------------------------

  describe('trace-to-via clearance', () => {
    it('detects trace too close to a via', () => {
      const via: PCBObstacle = {
        id: 'via-1',
        type: 'via',
        layer: 'all',
        netId: 'net-1',
        geometry: { kind: 'circle', cx: 10, cy: 10, radius: 0.3 },
      };
      checker.buildObstacleDB([via]);
      // Trace passing close to via on a different net
      const violations = checker.checkTrace(
        [{ x: 0, y: 10.4 }, { x: 20, y: 10.4 }],
        0.2,
        'front',
        'net-2',
      );
      expect(violations.some((v) => v.type === 'trace-via')).toBe(true);
    });

    it('no violation for same-net trace near via', () => {
      const via: PCBObstacle = {
        id: 'via-1',
        type: 'via',
        layer: 'all',
        netId: 'net-1',
        geometry: { kind: 'circle', cx: 10, cy: 10, radius: 0.3 },
      };
      checker.buildObstacleDB([via]);
      const violations = checker.checkTrace(
        [{ x: 5, y: 10 }, { x: 15, y: 10 }],
        0.2,
        'front',
        'net-1',
      );
      expect(violations.filter((v) => v.type === 'trace-via').length).toBe(0);
    });
  });

  // ---------------------------------------------------------------------------
  // Via-to-Via Clearance
  // ---------------------------------------------------------------------------

  describe('via-to-via clearance', () => {
    it('detects two vias placed too close together', () => {
      const via1: PCBObstacle = {
        id: 'via-1',
        type: 'via',
        layer: 'all',
        netId: 'net-1',
        geometry: { kind: 'circle', cx: 10, cy: 10, radius: 0.3 },
      };
      checker.buildObstacleDB([via1]);
      // New via at 10.5mm — center-to-center = 0.5mm
      // Edge-to-edge = 0.5 - 0.3 - 0.3 = -0.1mm → violation
      const violations = checker.checkVia({ x: 10.5, y: 10 }, 0.3, 0.6, 'net-2');
      expect(violations.some((v) => v.type === 'via-via')).toBe(true);
    });

    it('passes when vias have adequate spacing', () => {
      const via1: PCBObstacle = {
        id: 'via-1',
        type: 'via',
        layer: 'all',
        netId: 'net-1',
        geometry: { kind: 'circle', cx: 10, cy: 10, radius: 0.3 },
      };
      checker.buildObstacleDB([via1]);
      // Via at 11.5mm — center-to-center = 1.5mm, edge-to-edge = 0.9mm > 0.2mm
      const violations = checker.checkVia({ x: 11.5, y: 10 }, 0.3, 0.6, 'net-2');
      expect(violations.filter((v) => v.type === 'via-via').length).toBe(0);
    });

    it('same-net vias do not violate clearance', () => {
      const via1: PCBObstacle = {
        id: 'via-1',
        type: 'via',
        layer: 'all',
        netId: 'net-1',
        geometry: { kind: 'circle', cx: 10, cy: 10, radius: 0.3 },
      };
      checker.buildObstacleDB([via1]);
      const violations = checker.checkVia({ x: 10.5, y: 10 }, 0.3, 0.6, 'net-1');
      expect(violations.filter((v) => v.type === 'via-via').length).toBe(0);
    });
  });

  // ---------------------------------------------------------------------------
  // Trace-to-Edge Clearance
  // ---------------------------------------------------------------------------

  describe('trace-to-edge clearance', () => {
    it('detects trace too close to board edge', () => {
      const edge: PCBObstacle = {
        id: 'edge-bottom',
        type: 'edge',
        layer: 'all',
        geometry: { kind: 'line', x1: 0, y1: 0, x2: 100, y2: 0 },
      };
      checker.buildObstacleDB([edge]);
      // Default edge clearance is 0.5mm
      // Trace at y=0.2, width 0.2 → edge of trace at y=0.1, only 0.1mm from board edge
      const violations = checker.checkTrace(
        [{ x: 10, y: 0.2 }, { x: 50, y: 0.2 }],
        0.2,
        'front',
      );
      expect(violations.some((v) => v.type === 'trace-edge')).toBe(true);
    });

    it('passes when trace is far from board edge', () => {
      const edge: PCBObstacle = {
        id: 'edge-bottom',
        type: 'edge',
        layer: 'all',
        geometry: { kind: 'line', x1: 0, y1: 0, x2: 100, y2: 0 },
      };
      checker.buildObstacleDB([edge]);
      // Trace at y=5, well within clearance
      const violations = checker.checkTrace(
        [{ x: 10, y: 5 }, { x: 50, y: 5 }],
        0.25,
        'front',
      );
      expect(violations.filter((v) => v.type === 'trace-edge').length).toBe(0);
    });

    it('checks via proximity to board edge', () => {
      const edge: PCBObstacle = {
        id: 'edge-left',
        type: 'edge',
        layer: 'all',
        geometry: { kind: 'line', x1: 0, y1: 0, x2: 0, y2: 100 },
      };
      checker.buildObstacleDB([edge]);
      // Via very close to left edge
      const violations = checker.checkVia({ x: 0.2, y: 50 }, 0.3, 0.6, 'net-1');
      // Via edge at x = 0.2 - 0.3 = -0.1, so it extends past the edge
      expect(violations.some((v) => v.type === 'trace-edge')).toBe(true);
    });
  });

  // ---------------------------------------------------------------------------
  // Minimum Trace Width
  // ---------------------------------------------------------------------------

  describe('minimum trace width', () => {
    it('flags trace below minimum width (default 0.1mm)', () => {
      const violations = checker.checkTrace(
        [{ x: 0, y: 0 }, { x: 10, y: 0 }],
        0.05,
        'front',
      );
      expect(violations.some((v) => v.type === 'min-width')).toBe(true);
      const minWidthViolation = violations.find((v) => v.type === 'min-width');
      expect(minWidthViolation?.severity).toBe('error');
    });

    it('passes trace at or above minimum width', () => {
      const violations = checker.checkTrace(
        [{ x: 0, y: 0 }, { x: 10, y: 0 }],
        0.25,
        'front',
      );
      expect(violations.filter((v) => v.type === 'min-width').length).toBe(0);
    });

    it('custom minimum width is enforced', () => {
      checker.setMinTraceWidth(0.3);
      const violations = checker.checkTrace(
        [{ x: 0, y: 0 }, { x: 10, y: 0 }],
        0.25,
        'front',
      );
      expect(violations.some((v) => v.type === 'min-width')).toBe(true);
    });
  });

  // ---------------------------------------------------------------------------
  // Same-Net Bypass
  // ---------------------------------------------------------------------------

  describe('same-net bypass', () => {
    it('does not flag clearance violation between same-net obstacles', () => {
      const pad: PCBObstacle = {
        id: 'pad-1',
        type: 'pad',
        layer: 'front',
        netId: 'net-1',
        geometry: { kind: 'circle', cx: 10, cy: 10, radius: 0.5 },
      };
      const trace: PCBObstacle = {
        id: 'trace-1',
        type: 'trace',
        layer: 'front',
        netId: 'net-1',
        geometry: { kind: 'segment', x1: 5, y1: 10, x2: 10, y2: 10, width: 0.25 },
      };
      checker.buildObstacleDB([pad, trace]);
      // Check another trace on same net that overlaps
      const violations = checker.checkTrace(
        [{ x: 8, y: 10 }, { x: 12, y: 10 }],
        0.25,
        'front',
        'net-1',
      );
      expect(violations.filter((v) =>
        v.type === 'trace-pad' || v.type === 'trace-trace',
      ).length).toBe(0);
    });

    it('flags clearance violation between different-net obstacles', () => {
      const pad: PCBObstacle = {
        id: 'pad-1',
        type: 'pad',
        layer: 'front',
        netId: 'net-1',
        geometry: { kind: 'circle', cx: 10, cy: 10, radius: 0.5 },
      };
      checker.buildObstacleDB([pad]);
      // Trace on different net very close to pad
      const violations = checker.checkTrace(
        [{ x: 8, y: 10 }, { x: 12, y: 10 }],
        0.25,
        'front',
        'net-2',
      );
      expect(violations.some((v) => v.type === 'trace-pad')).toBe(true);
    });
  });

  // ---------------------------------------------------------------------------
  // Layer Filtering
  // ---------------------------------------------------------------------------

  describe('layer filtering', () => {
    it('does not detect violations between different layers', () => {
      const frontTrace: PCBObstacle = {
        id: 'trace-front',
        type: 'trace',
        layer: 'front',
        netId: 'net-1',
        geometry: { kind: 'segment', x1: 0, y1: 5, x2: 20, y2: 5, width: 0.25 },
      };
      checker.buildObstacleDB([frontTrace]);
      // Back-layer trace overlapping the front trace — no violation
      const violations = checker.checkTrace(
        [{ x: 0, y: 5 }, { x: 20, y: 5 }],
        0.25,
        'back',
        'net-2',
      );
      expect(violations.filter((v) => v.type === 'trace-trace').length).toBe(0);
    });

    it('detects violations on the same layer', () => {
      const frontTrace: PCBObstacle = {
        id: 'trace-front',
        type: 'trace',
        layer: 'front',
        netId: 'net-1',
        geometry: { kind: 'segment', x1: 0, y1: 5, x2: 20, y2: 5, width: 0.25 },
      };
      checker.buildObstacleDB([frontTrace]);
      // Same layer, different net, overlapping → violation
      const violations = checker.checkTrace(
        [{ x: 0, y: 5.3 }, { x: 20, y: 5.3 }],
        0.25,
        'front',
        'net-2',
      );
      expect(violations.some((v) => v.type === 'trace-trace')).toBe(true);
    });
  });

  // ---------------------------------------------------------------------------
  // Through-Hole (layer='all')
  // ---------------------------------------------------------------------------

  describe('through-hole obstacles (layer="all")', () => {
    it('through-hole pad checks against front-layer trace', () => {
      const thtPad: PCBObstacle = {
        id: 'tht-pad-1',
        type: 'pad',
        layer: 'all',
        netId: 'net-1',
        geometry: { kind: 'circle', cx: 10, cy: 10, radius: 0.5 },
      };
      checker.buildObstacleDB([thtPad]);
      const violations = checker.checkTrace(
        [{ x: 10, y: 10.55 }, { x: 20, y: 10.55 }],
        0.2,
        'front',
        'net-2',
      );
      expect(violations.some((v) => v.type === 'trace-pad')).toBe(true);
    });

    it('through-hole pad checks against back-layer trace', () => {
      const thtPad: PCBObstacle = {
        id: 'tht-pad-1',
        type: 'pad',
        layer: 'all',
        netId: 'net-1',
        geometry: { kind: 'circle', cx: 10, cy: 10, radius: 0.5 },
      };
      checker.buildObstacleDB([thtPad]);
      const violations = checker.checkTrace(
        [{ x: 10, y: 10.55 }, { x: 20, y: 10.55 }],
        0.2,
        'back',
        'net-2',
      );
      expect(violations.some((v) => v.type === 'trace-pad')).toBe(true);
    });

    it('via (layer=all) checks against both layers', () => {
      const via: PCBObstacle = {
        id: 'via-1',
        type: 'via',
        layer: 'all',
        netId: 'net-1',
        geometry: { kind: 'circle', cx: 10, cy: 10, radius: 0.3 },
      };
      checker.buildObstacleDB([via]);
      // Check front
      let violations = checker.checkTrace(
        [{ x: 10, y: 10.4 }, { x: 20, y: 10.4 }],
        0.2,
        'front',
        'net-2',
      );
      expect(violations.some((v) => v.type === 'trace-via')).toBe(true);
      // Check back
      violations = checker.checkTrace(
        [{ x: 10, y: 10.4 }, { x: 20, y: 10.4 }],
        0.2,
        'back',
        'net-2',
      );
      expect(violations.some((v) => v.type === 'trace-via')).toBe(true);
    });
  });

  // ---------------------------------------------------------------------------
  // checkVia
  // ---------------------------------------------------------------------------

  describe('checkVia', () => {
    it('returns empty for via on empty board', () => {
      const violations = checker.checkVia({ x: 10, y: 10 }, 0.3, 0.6);
      expect(violations.length).toBe(0);
    });

    it('detects via-to-pad clearance violation', () => {
      const pad: PCBObstacle = {
        id: 'pad-1',
        type: 'pad',
        layer: 'front',
        netId: 'net-1',
        geometry: { kind: 'circle', cx: 10, cy: 10, radius: 0.5 },
      };
      checker.buildObstacleDB([pad]);
      // Via placed right next to pad — different net
      const violations = checker.checkVia({ x: 10.8, y: 10 }, 0.3, 0.6, 'net-2');
      // center-to-center = 0.8mm, pad radius = 0.5, via radius = 0.3, edge-to-edge = 0.0mm
      expect(violations.length).toBeGreaterThan(0);
    });

    it('detects via-to-trace clearance violation', () => {
      const trace: PCBObstacle = {
        id: 'trace-1',
        type: 'trace',
        layer: 'front',
        netId: 'net-1',
        geometry: { kind: 'segment', x1: 0, y1: 10, x2: 20, y2: 10, width: 0.25 },
      };
      checker.buildObstacleDB([trace]);
      // Via placed right on the trace — different net
      const violations = checker.checkVia({ x: 10, y: 10.3 }, 0.3, 0.6, 'net-2');
      expect(violations.length).toBeGreaterThan(0);
    });
  });

  // ---------------------------------------------------------------------------
  // checkAll (full board check)
  // ---------------------------------------------------------------------------

  describe('checkAll', () => {
    it('returns empty violations for well-spaced board', () => {
      const obstacles: PCBObstacle[] = [
        {
          id: 'trace-1',
          type: 'trace',
          layer: 'front',
          netId: 'net-1',
          geometry: { kind: 'segment', x1: 0, y1: 0, x2: 10, y2: 0, width: 0.25 },
        },
        {
          id: 'trace-2',
          type: 'trace',
          layer: 'front',
          netId: 'net-2',
          geometry: { kind: 'segment', x1: 0, y1: 5, x2: 10, y2: 5, width: 0.25 },
        },
      ];
      checker.buildObstacleDB(obstacles);
      const violations = checker.checkAll();
      expect(violations.length).toBe(0);
    });

    it('finds all pairwise violations in the board', () => {
      const obstacles: PCBObstacle[] = [
        {
          id: 'trace-1',
          type: 'trace',
          layer: 'front',
          netId: 'net-1',
          geometry: { kind: 'segment', x1: 0, y1: 0, x2: 10, y2: 0, width: 0.25 },
        },
        {
          id: 'trace-2',
          type: 'trace',
          layer: 'front',
          netId: 'net-2',
          geometry: { kind: 'segment', x1: 0, y1: 0.3, x2: 10, y2: 0.3, width: 0.25 },
        },
        {
          id: 'pad-1',
          type: 'pad',
          layer: 'front',
          netId: 'net-3',
          geometry: { kind: 'circle', cx: 5, cy: 0.15, radius: 0.4 },
        },
      ];
      checker.buildObstacleDB(obstacles);
      const violations = checker.checkAll();
      // Should find multiple violations (trace-trace, trace-pad, etc.)
      expect(violations.length).toBeGreaterThan(0);
    });

    it('does not double-count violations (A→B and B→A)', () => {
      const obstacles: PCBObstacle[] = [
        {
          id: 'trace-a',
          type: 'trace',
          layer: 'front',
          netId: 'net-1',
          geometry: { kind: 'segment', x1: 0, y1: 0, x2: 10, y2: 0, width: 0.25 },
        },
        {
          id: 'trace-b',
          type: 'trace',
          layer: 'front',
          netId: 'net-2',
          geometry: { kind: 'segment', x1: 0, y1: 0.3, x2: 10, y2: 0.3, width: 0.25 },
        },
      ];
      checker.buildObstacleDB(obstacles);
      const violations = checker.checkAll();
      // Only one violation for this pair, not two
      const traceTraceViolations = violations.filter((v) => v.type === 'trace-trace');
      expect(traceTraceViolations.length).toBe(1);
    });
  });

  // ---------------------------------------------------------------------------
  // Violation Results
  // ---------------------------------------------------------------------------

  describe('violation results', () => {
    it('getViolations returns accumulated violations from checkAll', () => {
      const obstacles: PCBObstacle[] = [
        {
          id: 'trace-1',
          type: 'trace',
          layer: 'front',
          netId: 'net-1',
          geometry: { kind: 'segment', x1: 0, y1: 0, x2: 10, y2: 0, width: 0.25 },
        },
        {
          id: 'trace-2',
          type: 'trace',
          layer: 'front',
          netId: 'net-2',
          geometry: { kind: 'segment', x1: 0, y1: 0.3, x2: 10, y2: 0.3, width: 0.25 },
        },
      ];
      checker.buildObstacleDB(obstacles);
      checker.checkAll();
      expect(checker.getViolations().length).toBeGreaterThan(0);
      expect(checker.getViolationCount()).toBeGreaterThan(0);
    });

    it('clearViolations resets the violation list', () => {
      const obstacles: PCBObstacle[] = [
        {
          id: 'trace-1',
          type: 'trace',
          layer: 'front',
          netId: 'net-1',
          geometry: { kind: 'segment', x1: 0, y1: 0, x2: 10, y2: 0, width: 0.25 },
        },
        {
          id: 'trace-2',
          type: 'trace',
          layer: 'front',
          netId: 'net-2',
          geometry: { kind: 'segment', x1: 0, y1: 0.3, x2: 10, y2: 0.3, width: 0.25 },
        },
      ];
      checker.buildObstacleDB(obstacles);
      checker.checkAll();
      expect(checker.getViolationCount()).toBeGreaterThan(0);
      checker.clearViolations();
      expect(checker.getViolationCount()).toBe(0);
    });

    it('violation contains position, obstacleIds, and clearance info', () => {
      const obstacles: PCBObstacle[] = [
        {
          id: 'trace-1',
          type: 'trace',
          layer: 'front',
          netId: 'net-1',
          geometry: { kind: 'segment', x1: 0, y1: 0, x2: 10, y2: 0, width: 0.25 },
        },
        {
          id: 'trace-2',
          type: 'trace',
          layer: 'front',
          netId: 'net-2',
          geometry: { kind: 'segment', x1: 0, y1: 0.3, x2: 10, y2: 0.3, width: 0.25 },
        },
      ];
      checker.buildObstacleDB(obstacles);
      const violations = checker.checkAll();
      const v = violations[0];
      expect(v.position).toHaveProperty('x');
      expect(v.position).toHaveProperty('y');
      expect(v.obstacleIds.length).toBeGreaterThanOrEqual(2);
      expect(v.clearanceRequired).toBeGreaterThan(0);
      expect(typeof v.clearanceActual).toBe('number');
    });
  });

  // ---------------------------------------------------------------------------
  // Edge Cases
  // ---------------------------------------------------------------------------

  describe('edge cases', () => {
    it('empty board returns no violations from checkAll', () => {
      expect(checker.checkAll().length).toBe(0);
    });

    it('single obstacle returns no violations from checkAll', () => {
      checker.addObstacle({
        id: 'only-trace',
        type: 'trace',
        layer: 'front',
        netId: 'net-1',
        geometry: { kind: 'segment', x1: 0, y1: 0, x2: 10, y2: 0, width: 0.25 },
      });
      expect(checker.checkAll().length).toBe(0);
    });

    it('handles overlapping same-net obstacles gracefully', () => {
      const obstacles: PCBObstacle[] = [
        {
          id: 'pad-a',
          type: 'pad',
          layer: 'front',
          netId: 'net-1',
          geometry: { kind: 'circle', cx: 10, cy: 10, radius: 0.5 },
        },
        {
          id: 'pad-b',
          type: 'pad',
          layer: 'front',
          netId: 'net-1',
          geometry: { kind: 'circle', cx: 10.2, cy: 10, radius: 0.5 },
        },
      ];
      checker.buildObstacleDB(obstacles);
      const violations = checker.checkAll();
      // Same net — no violations even though overlapping
      expect(violations.length).toBe(0);
    });

    it('handles zero-length trace (single point)', () => {
      // A trace with start === end, basically a dot
      const violations = checker.checkTrace([{ x: 5, y: 5 }], 0.25, 'front');
      // Should not crash; may return min-width or empty depending on width
      expect(Array.isArray(violations)).toBe(true);
    });

    it('handles polygon obstacle geometry', () => {
      const pour: PCBObstacle = {
        id: 'pour-1',
        type: 'pour',
        layer: 'front',
        netId: 'gnd',
        geometry: {
          kind: 'polygon',
          points: [
            { x: 0, y: 0 },
            { x: 10, y: 0 },
            { x: 10, y: 10 },
            { x: 0, y: 10 },
          ],
        },
      };
      checker.buildObstacleDB([pour]);
      // Trace inside the polygon but different net
      const violations = checker.checkTrace(
        [{ x: 2, y: 5 }, { x: 8, y: 5 }],
        0.25,
        'front',
        'net-vcc',
      );
      // Should detect clearance violation with pour edges
      expect(violations.length).toBeGreaterThan(0);
    });
  });

  // ---------------------------------------------------------------------------
  // Performance
  // ---------------------------------------------------------------------------

  describe('performance', () => {
    it('checkTrace completes in <50ms with 100 obstacles', () => {
      const obstacles: PCBObstacle[] = [];
      for (let i = 0; i < 100; i++) {
        obstacles.push({
          id: `pad-${String(i)}`,
          type: 'pad',
          layer: 'front',
          netId: `net-${String(i)}`,
          geometry: {
            kind: 'circle',
            cx: (i % 10) * 5,
            cy: Math.floor(i / 10) * 5,
            radius: 0.5,
          },
        });
      }
      checker.buildObstacleDB(obstacles);

      const start = performance.now();
      checker.checkTrace(
        [{ x: 0, y: 25 }, { x: 50, y: 25 }],
        0.25,
        'front',
        'net-new',
      );
      const elapsed = performance.now() - start;
      expect(elapsed).toBeLessThan(50);
    });

    it('checkAll completes in <200ms with 100 obstacles', () => {
      const obstacles: PCBObstacle[] = [];
      for (let i = 0; i < 100; i++) {
        obstacles.push({
          id: `trace-${String(i)}`,
          type: 'trace',
          layer: i % 2 === 0 ? 'front' : 'back',
          netId: `net-${String(i % 20)}`,
          geometry: {
            kind: 'segment',
            x1: (i % 10) * 5,
            y1: Math.floor(i / 10) * 5,
            x2: (i % 10) * 5 + 4,
            y2: Math.floor(i / 10) * 5,
            width: 0.25,
          },
        });
      }
      checker.buildObstacleDB(obstacles);

      const start = performance.now();
      checker.checkAll();
      const elapsed = performance.now() - start;
      expect(elapsed).toBeLessThan(200);
    });
  });

  // ---------------------------------------------------------------------------
  // Geometry Distance Calculations
  // ---------------------------------------------------------------------------

  describe('geometry distance calculations', () => {
    it('segment-to-segment parallel distance is correctly computed', () => {
      // Two horizontal traces, 1mm apart center-to-center
      const existing: PCBObstacle = {
        id: 'trace-1',
        type: 'trace',
        layer: 'front',
        netId: 'net-1',
        geometry: { kind: 'segment', x1: 0, y1: 0, x2: 10, y2: 0, width: 0.25 },
      };
      checker.buildObstacleDB([existing]);
      // Trace 0.55mm away — edge-to-edge = 0.55 - 0.125 - 0.125 = 0.3mm > 0.2mm
      const violations = checker.checkTrace(
        [{ x: 0, y: 0.55 }, { x: 10, y: 0.55 }],
        0.25,
        'front',
        'net-2',
      );
      expect(violations.filter((v) => v.type === 'trace-trace').length).toBe(0);
    });

    it('segment-to-circle distance accounts for radius', () => {
      const circle: PCBObstacle = {
        id: 'pad-1',
        type: 'pad',
        layer: 'front',
        netId: 'net-1',
        geometry: { kind: 'circle', cx: 5, cy: 5, radius: 1.0 },
      };
      checker.buildObstacleDB([circle]);
      // Trace at y=6.3, width=0.2 → trace edge at y=6.2, pad edge at y=6.0
      // clearance = 0.2mm = exactly at limit
      const violations = checker.checkTrace(
        [{ x: 0, y: 6.3 }, { x: 10, y: 6.3 }],
        0.2,
        'front',
        'net-2',
      );
      // At exactly the clearance limit, should pass
      expect(violations.filter((v) => v.type === 'trace-pad').length).toBe(0);
    });

    it('T-junction: trace endpoint near perpendicular trace midpoint', () => {
      const horizontal: PCBObstacle = {
        id: 'trace-h',
        type: 'trace',
        layer: 'front',
        netId: 'net-1',
        geometry: { kind: 'segment', x1: 0, y1: 10, x2: 20, y2: 10, width: 0.25 },
      };
      checker.buildObstacleDB([horizontal]);
      // Vertical trace ending just before the horizontal trace — different net
      // Endpoint at y=9.7, horizontal trace edge at y=10-0.125=9.875
      // Gap = 9.875 - 9.7 - 0.125 = 0.05mm < 0.2mm clearance
      const violations = checker.checkTrace(
        [{ x: 10, y: 5 }, { x: 10, y: 9.7 }],
        0.25,
        'front',
        'net-2',
      );
      expect(violations.some((v) => v.type === 'trace-trace')).toBe(true);
    });
  });

  // ---------------------------------------------------------------------------
  // Multiple Segments in a Trace
  // ---------------------------------------------------------------------------

  describe('multi-segment traces', () => {
    it('checks each segment of a multi-point trace', () => {
      const existing: PCBObstacle = {
        id: 'pad-1',
        type: 'pad',
        layer: 'front',
        netId: 'net-1',
        geometry: { kind: 'circle', cx: 15, cy: 5, radius: 0.5 },
      };
      checker.buildObstacleDB([existing]);
      // Multi-segment trace: first segment far, second segment close to pad
      const violations = checker.checkTrace(
        [
          { x: 0, y: 0 },
          { x: 10, y: 0 },
          { x: 15, y: 5.55 }, // close to pad
        ],
        0.2,
        'front',
        'net-2',
      );
      expect(violations.some((v) => v.type === 'trace-pad')).toBe(true);
    });

    it('no violations when all segments are far from obstacles', () => {
      const pad: PCBObstacle = {
        id: 'pad-1',
        type: 'pad',
        layer: 'front',
        netId: 'net-1',
        geometry: { kind: 'circle', cx: 50, cy: 50, radius: 0.5 },
      };
      checker.buildObstacleDB([pad]);
      const violations = checker.checkTrace(
        [
          { x: 0, y: 0 },
          { x: 10, y: 0 },
          { x: 20, y: 10 },
        ],
        0.25,
        'front',
        'net-2',
      );
      expect(violations.filter((v) => v.type === 'trace-pad').length).toBe(0);
    });
  });
});
