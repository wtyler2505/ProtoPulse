import { describe, it, expect, beforeEach } from 'vitest';
import { TraceEditor } from '@/lib/pcb/trace-router';
import type { TracePoint, TraceResult } from '@/lib/pcb/trace-router';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Build a simple horizontal trace result for testing. */
function makeHorizontalTrace(netId = 'net1'): TraceResult {
  return {
    wires: [
      {
        points: [
          { x: 0, y: 0 },
          { x: 10, y: 0 },
          { x: 20, y: 0 },
        ],
        layer: 'front',
        width: 0.5,
      },
    ],
    vias: [],
    netId,
  };
}

/** Build an L-shaped trace (horizontal then vertical). */
function makeLShapeTrace(netId = 'net1'): TraceResult {
  return {
    wires: [
      {
        points: [
          { x: 0, y: 0 },
          { x: 10, y: 0 },
          { x: 10, y: 10 },
        ],
        layer: 'front',
        width: 0.5,
      },
    ],
    vias: [],
    netId,
  };
}

/** Build a multi-wire trace with a via in the middle. */
function makeMultiLayerTrace(netId = 'net1'): TraceResult {
  return {
    wires: [
      {
        points: [
          { x: 0, y: 0 },
          { x: 10, y: 0 },
        ],
        layer: 'front',
        width: 0.5,
      },
      {
        points: [
          { x: 10, y: 0 },
          { x: 20, y: 0 },
        ],
        layer: 'back',
        width: 0.5,
      },
    ],
    vias: [
      {
        id: 'via-1',
        position: { x: 10, y: 0 },
        drillDiameter: 0.3,
        outerDiameter: 0.6,
        type: 'through',
        fromLayer: 'front',
        toLayer: 'back',
        tented: true,
      },
    ],
    netId,
  };
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('TraceEditor', () => {
  let editor: TraceEditor;

  beforeEach(() => {
    editor = new TraceEditor();
  });

  // ─────────────────────────────────────────────────────────────────────
  // hitTestSegment — find the closest segment to a click point
  // ─────────────────────────────────────────────────────────────────────

  describe('hitTestSegment', () => {
    it('returns the hit segment when point is close to a wire', () => {
      const trace = makeHorizontalTrace();
      const result = editor.hitTestSegment({ x: 5, y: 0.1 }, [trace], 1.0);
      expect(result).not.toBeNull();
      expect(result!.traceIndex).toBe(0);
      expect(result!.wireIndex).toBe(0);
      expect(result!.segmentIndex).toBe(0);
    });

    it('returns null when point is too far from any segment', () => {
      const trace = makeHorizontalTrace();
      const result = editor.hitTestSegment({ x: 5, y: 10 }, [trace], 1.0);
      expect(result).toBeNull();
    });

    it('identifies the correct segment in a multi-segment wire', () => {
      const trace = makeHorizontalTrace();
      // Click near the second segment (10,0)→(20,0) at x=15
      const result = editor.hitTestSegment({ x: 15, y: 0.1 }, [trace], 1.0);
      expect(result).not.toBeNull();
      expect(result!.segmentIndex).toBe(1);
    });

    it('returns the closest segment when multiple are within tolerance', () => {
      const trace = makeLShapeTrace();
      // Click at (10, 0.5) — closer to horizontal than vertical
      const result = editor.hitTestSegment({ x: 9.5, y: 0.3 }, [trace], 1.0);
      expect(result).not.toBeNull();
      expect(result!.segmentIndex).toBe(0);
    });

    it('works with multiple traces', () => {
      const trace1 = makeHorizontalTrace('net1');
      const trace2: TraceResult = {
        wires: [
          {
            points: [
              { x: 0, y: 5 },
              { x: 10, y: 5 },
            ],
            layer: 'front',
            width: 0.5,
          },
        ],
        vias: [],
        netId: 'net2',
      };
      const result = editor.hitTestSegment({ x: 5, y: 4.8 }, [trace1, trace2], 1.0);
      expect(result).not.toBeNull();
      expect(result!.traceIndex).toBe(1);
    });

    it('returns hit on multi-layer trace', () => {
      const trace = makeMultiLayerTrace();
      // Click near back-layer segment
      const result = editor.hitTestSegment({ x: 15, y: 0.1 }, [trace], 1.0);
      expect(result).not.toBeNull();
      expect(result!.wireIndex).toBe(1);
    });

    it('respects tolerance parameter', () => {
      const trace = makeHorizontalTrace();
      // Point is 2mm away — should miss with tolerance 1, hit with tolerance 3
      const miss = editor.hitTestSegment({ x: 5, y: 2 }, [trace], 1.0);
      expect(miss).toBeNull();
      const hit = editor.hitTestSegment({ x: 5, y: 2 }, [trace], 3.0);
      expect(hit).not.toBeNull();
    });
  });

  // ─────────────────────────────────────────────────────────────────────
  // hitTestVertex — find the closest vertex to a click point
  // ─────────────────────────────────────────────────────────────────────

  describe('hitTestVertex', () => {
    it('returns the hit vertex when point is close', () => {
      const trace = makeLShapeTrace();
      const result = editor.hitTestVertex({ x: 10.1, y: 0.1 }, [trace], 1.0);
      expect(result).not.toBeNull();
      expect(result!.traceIndex).toBe(0);
      expect(result!.wireIndex).toBe(0);
      expect(result!.vertexIndex).toBe(1);
    });

    it('returns null when no vertex is within tolerance', () => {
      const trace = makeLShapeTrace();
      const result = editor.hitTestVertex({ x: 5, y: 5 }, [trace], 0.5);
      expect(result).toBeNull();
    });

    it('returns the closest vertex when multiple are nearby', () => {
      const trace = makeHorizontalTrace();
      // Click at (10.2, 0) — closer to vertex at (10,0) than (0,0) or (20,0)
      const result = editor.hitTestVertex({ x: 10.2, y: 0 }, [trace], 1.0);
      expect(result).not.toBeNull();
      expect(result!.vertexIndex).toBe(1);
    });

    it('can find the first vertex (start point)', () => {
      const trace = makeHorizontalTrace();
      const result = editor.hitTestVertex({ x: 0.1, y: 0.1 }, [trace], 0.5);
      expect(result).not.toBeNull();
      expect(result!.vertexIndex).toBe(0);
    });

    it('can find the last vertex (end point)', () => {
      const trace = makeHorizontalTrace();
      const result = editor.hitTestVertex({ x: 19.9, y: 0.1 }, [trace], 0.5);
      expect(result).not.toBeNull();
      expect(result!.vertexIndex).toBe(2);
    });
  });

  // ─────────────────────────────────────────────────────────────────────
  // moveVertex — drag a vertex to a new position
  // ─────────────────────────────────────────────────────────────────────

  describe('moveVertex', () => {
    it('moves a vertex to a new position', () => {
      const trace = makeLShapeTrace();
      const updated = editor.moveVertex(trace, 0, 1, { x: 12, y: 0 });
      expect(updated.wires[0].points[1]).toEqual({ x: 12, y: 0 });
    });

    it('does not modify the original trace', () => {
      const trace = makeLShapeTrace();
      const original = JSON.parse(JSON.stringify(trace)) as TraceResult;
      editor.moveVertex(trace, 0, 1, { x: 12, y: 0 });
      expect(trace).toEqual(original);
    });

    it('preserves other vertices unchanged', () => {
      const trace = makeLShapeTrace();
      const updated = editor.moveVertex(trace, 0, 1, { x: 12, y: 0 });
      expect(updated.wires[0].points[0]).toEqual({ x: 0, y: 0 });
      expect(updated.wires[0].points[2]).toEqual({ x: 10, y: 10 });
    });

    it('preserves wire metadata (layer, width)', () => {
      const trace = makeLShapeTrace();
      const updated = editor.moveVertex(trace, 0, 1, { x: 12, y: 0 });
      expect(updated.wires[0].layer).toBe('front');
      expect(updated.wires[0].width).toBe(0.5);
    });

    it('preserves vias and netId', () => {
      const trace = makeMultiLayerTrace();
      const updated = editor.moveVertex(trace, 0, 0, { x: -2, y: 0 });
      expect(updated.vias).toEqual(trace.vias);
      expect(updated.netId).toBe('net1');
    });
  });

  // ─────────────────────────────────────────────────────────────────────
  // moveSegment — translate a segment by a delta
  // ─────────────────────────────────────────────────────────────────────

  describe('moveSegment', () => {
    it('moves both endpoints of a segment by the given delta', () => {
      const trace = makeHorizontalTrace();
      const delta: TracePoint = { x: 0, y: 5 };
      const updated = editor.moveSegment(trace, 0, 0, delta);
      // Segment 0 is from points[0] to points[1]
      expect(updated.wires[0].points[0].y).toBeCloseTo(5, 5);
      expect(updated.wires[0].points[1].y).toBeCloseTo(5, 5);
    });

    it('does not modify the original trace', () => {
      const trace = makeHorizontalTrace();
      const original = JSON.parse(JSON.stringify(trace)) as TraceResult;
      editor.moveSegment(trace, 0, 0, { x: 0, y: 5 });
      expect(trace).toEqual(original);
    });

    it('moves both vertices shared with adjacent segments', () => {
      const trace = makeHorizontalTrace();
      // Moving segment 0 (points[0]→points[1]) moves points 0 and 1
      const updated = editor.moveSegment(trace, 0, 0, { x: 0, y: 3 });
      expect(updated.wires[0].points[0].y).toBeCloseTo(3, 5);
      expect(updated.wires[0].points[1].y).toBeCloseTo(3, 5);
      // Point 2 should be unchanged
      expect(updated.wires[0].points[2].y).toBeCloseTo(0, 5);
    });

    it('handles diagonal delta', () => {
      const trace = makeHorizontalTrace();
      const updated = editor.moveSegment(trace, 0, 1, { x: 2, y: 3 });
      // Segment 1 is from points[1] to points[2]
      expect(updated.wires[0].points[1].x).toBeCloseTo(12, 5);
      expect(updated.wires[0].points[1].y).toBeCloseTo(3, 5);
      expect(updated.wires[0].points[2].x).toBeCloseTo(22, 5);
      expect(updated.wires[0].points[2].y).toBeCloseTo(3, 5);
    });
  });

  // ─────────────────────────────────────────────────────────────────────
  // deleteSegment — remove a segment, splitting the trace
  // ─────────────────────────────────────────────────────────────────────

  describe('deleteSegment', () => {
    it('returns two trace fragments when deleting a middle segment', () => {
      const trace: TraceResult = {
        wires: [
          {
            points: [
              { x: 0, y: 0 },
              { x: 10, y: 0 },
              { x: 20, y: 0 },
              { x: 30, y: 0 },
            ],
            layer: 'front',
            width: 0.5,
          },
        ],
        vias: [],
        netId: 'net1',
      };
      // Delete segment 1 (10,0)→(20,0)
      const fragments = editor.deleteSegment(trace, 0, 1);
      expect(fragments).toHaveLength(2);
      // First fragment: (0,0)→(10,0)
      expect(fragments[0].wires[0].points).toEqual([
        { x: 0, y: 0 },
        { x: 10, y: 0 },
      ]);
      // Second fragment: (20,0)→(30,0)
      expect(fragments[1].wires[0].points).toEqual([
        { x: 20, y: 0 },
        { x: 30, y: 0 },
      ]);
    });

    it('returns one fragment when deleting the first segment', () => {
      const trace = makeHorizontalTrace();
      // Delete segment 0 (0,0)→(10,0)
      const fragments = editor.deleteSegment(trace, 0, 0);
      expect(fragments).toHaveLength(1);
      expect(fragments[0].wires[0].points).toEqual([
        { x: 10, y: 0 },
        { x: 20, y: 0 },
      ]);
    });

    it('returns one fragment when deleting the last segment', () => {
      const trace = makeHorizontalTrace();
      // Delete segment 1 (10,0)→(20,0)
      const fragments = editor.deleteSegment(trace, 0, 1);
      expect(fragments).toHaveLength(1);
      expect(fragments[0].wires[0].points).toEqual([
        { x: 0, y: 0 },
        { x: 10, y: 0 },
      ]);
    });

    it('returns empty array when deleting the only segment', () => {
      const trace: TraceResult = {
        wires: [
          {
            points: [
              { x: 0, y: 0 },
              { x: 10, y: 0 },
            ],
            layer: 'front',
            width: 0.5,
          },
        ],
        vias: [],
        netId: 'net1',
      };
      const fragments = editor.deleteSegment(trace, 0, 0);
      expect(fragments).toHaveLength(0);
    });

    it('preserves netId on all fragments', () => {
      const trace: TraceResult = {
        wires: [
          {
            points: [
              { x: 0, y: 0 },
              { x: 10, y: 0 },
              { x: 20, y: 0 },
              { x: 30, y: 0 },
            ],
            layer: 'front',
            width: 0.5,
          },
        ],
        vias: [],
        netId: 'net1',
      };
      const fragments = editor.deleteSegment(trace, 0, 1);
      for (const frag of fragments) {
        expect(frag.netId).toBe('net1');
      }
    });

    it('preserves layer and width on fragments', () => {
      const trace: TraceResult = {
        wires: [
          {
            points: [
              { x: 0, y: 0 },
              { x: 10, y: 0 },
              { x: 20, y: 0 },
              { x: 30, y: 0 },
            ],
            layer: 'front',
            width: 0.5,
          },
        ],
        vias: [],
        netId: 'net1',
      };
      const fragments = editor.deleteSegment(trace, 0, 1);
      for (const frag of fragments) {
        expect(frag.wires[0].layer).toBe('front');
        expect(frag.wires[0].width).toBe(0.5);
      }
    });
  });

  // ─────────────────────────────────────────────────────────────────────
  // selectNet — select all wires for a given net
  // ─────────────────────────────────────────────────────────────────────

  describe('selectNet', () => {
    it('returns all traces matching the net ID', () => {
      const traces: TraceResult[] = [
        makeHorizontalTrace('net1'),
        makeHorizontalTrace('net2'),
        makeLShapeTrace('net1'),
      ];
      const selected = editor.selectNet('net1', traces);
      expect(selected).toHaveLength(2);
      expect(selected[0].netId).toBe('net1');
      expect(selected[1].netId).toBe('net1');
    });

    it('returns empty array when no traces match', () => {
      const traces: TraceResult[] = [makeHorizontalTrace('net1')];
      const selected = editor.selectNet('net99', traces);
      expect(selected).toHaveLength(0);
    });

    it('returns all traces when all match', () => {
      const traces: TraceResult[] = [
        makeHorizontalTrace('net1'),
        makeLShapeTrace('net1'),
      ];
      const selected = editor.selectNet('net1', traces);
      expect(selected).toHaveLength(2);
    });
  });
});
