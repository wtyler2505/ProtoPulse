import { describe, it, expect, beforeEach, vi } from 'vitest';
import {
  PcbClipboardManager,
  computeBoundingBox,
  computeOffset,
  remapIds,
} from '../pcb-clipboard';
import type {
  ClipboardItem,
  TraceData,
  ZoneData,
  ViaData,
  InstanceData,
} from '../pcb-clipboard';

// ---------------------------------------------------------------------------
// Factories
// ---------------------------------------------------------------------------

function makeTrace(overrides: Partial<ClipboardItem> = {}): ClipboardItem {
  return {
    type: 'trace',
    id: crypto.randomUUID(),
    data: {
      kind: 'trace',
      points: [
        { x: 0, y: 0 },
        { x: 10, y: 0 },
        { x: 10, y: 5 },
      ],
      width: 0.25,
    } satisfies TraceData,
    layer: 'F.Cu',
    netId: 'net-1',
    properties: {},
    ...overrides,
  };
}

function makeZone(overrides: Partial<ClipboardItem> = {}): ClipboardItem {
  return {
    type: 'zone',
    id: crypto.randomUUID(),
    data: {
      kind: 'zone',
      polygon: [
        { x: 0, y: 0 },
        { x: 20, y: 0 },
        { x: 20, y: 10 },
        { x: 0, y: 10 },
      ],
      fillType: 'solid',
    } satisfies ZoneData,
    layer: 'F.Cu',
    netId: 'net-gnd',
    properties: {},
    ...overrides,
  };
}

function makeVia(overrides: Partial<ClipboardItem> = {}): ClipboardItem {
  return {
    type: 'via',
    id: crypto.randomUUID(),
    data: {
      kind: 'via',
      position: { x: 5, y: 5 },
      drillDiameter: 0.3,
      outerDiameter: 0.6,
    } satisfies ViaData,
    layer: 'F.Cu',
    properties: {},
    ...overrides,
  };
}

function makeInstance(overrides: Partial<ClipboardItem> = {}): ClipboardItem {
  return {
    type: 'instance',
    id: crypto.randomUUID(),
    data: {
      kind: 'instance',
      position: { x: 15, y: 15 },
      rotation: 90,
      packageType: 'SOIC-8',
    } satisfies InstanceData,
    layer: 'F.Cu',
    properties: { refDes: 'U1' },
    ...overrides,
  };
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('PcbClipboardManager', () => {
  let mgr: PcbClipboardManager;

  beforeEach(() => {
    PcbClipboardManager.resetForTesting();
    mgr = PcbClipboardManager.getInstance();
  });

  // -----------------------------------------------------------------------
  // Singleton + subscribe
  // -----------------------------------------------------------------------

  describe('singleton and subscribe', () => {
    it('returns the same instance', () => {
      const a = PcbClipboardManager.getInstance();
      const b = PcbClipboardManager.getInstance();
      expect(a).toBe(b);
    });

    it('resetForTesting creates a fresh instance', () => {
      const a = PcbClipboardManager.getInstance();
      PcbClipboardManager.resetForTesting();
      const b = PcbClipboardManager.getInstance();
      expect(a).not.toBe(b);
    });

    it('notifies subscribers on copy', () => {
      const listener = vi.fn();
      mgr.subscribe(listener);
      mgr.copy([makeTrace()], 'design-1');
      expect(listener).toHaveBeenCalledTimes(1);
    });

    it('notifies subscribers on clear', () => {
      mgr.copy([makeTrace()], 'design-1');
      const listener = vi.fn();
      mgr.subscribe(listener);
      mgr.clear();
      expect(listener).toHaveBeenCalledTimes(1);
    });

    it('does not notify after unsubscribe', () => {
      const listener = vi.fn();
      const unsub = mgr.subscribe(listener);
      unsub();
      mgr.copy([makeTrace()], 'design-1');
      expect(listener).not.toHaveBeenCalled();
    });

    it('getSnapshot returns null initially', () => {
      expect(mgr.getSnapshot()).toBeNull();
    });

    it('getSnapshot returns state after copy', () => {
      mgr.copy([makeTrace()], 'design-1');
      const snap = mgr.getSnapshot();
      expect(snap).not.toBeNull();
      expect(snap?.items).toHaveLength(1);
      expect(snap?.sourceDesignId).toBe('design-1');
    });
  });

  // -----------------------------------------------------------------------
  // Copy
  // -----------------------------------------------------------------------

  describe('copy', () => {
    it('copies a single trace', () => {
      const trace = makeTrace();
      mgr.copy([trace], 'design-1');
      expect(mgr.canPaste()).toBe(true);
      expect(mgr.getItemCount()).toBe(1);
    });

    it('copies multiple items of mixed types', () => {
      const items = [makeTrace(), makeZone(), makeVia(), makeInstance()];
      mgr.copy(items, 'design-1');
      expect(mgr.getItemCount()).toBe(4);
    });

    it('ignores empty selection', () => {
      const listener = vi.fn();
      mgr.subscribe(listener);
      mgr.copy([], 'design-1');
      expect(mgr.canPaste()).toBe(false);
      expect(listener).not.toHaveBeenCalled();
    });

    it('overwrites previous clipboard on re-copy', () => {
      mgr.copy([makeTrace()], 'design-1');
      mgr.copy([makeVia(), makeZone()], 'design-2');
      expect(mgr.getItemCount()).toBe(2);
      expect(mgr.getSourceDesignId()).toBe('design-2');
    });

    it('deep-clones items (mutation safety)', () => {
      const trace = makeTrace();
      mgr.copy([trace], 'design-1');
      // Mutate original
      (trace.data as TraceData).points[0].x = 999;
      const snap = mgr.getSnapshot();
      expect((snap?.items[0].data as TraceData).points[0].x).toBe(0);
    });

    it('stores copiedAt timestamp', () => {
      const before = Date.now();
      mgr.copy([makeTrace()], 'design-1');
      const after = Date.now();
      const snap = mgr.getSnapshot();
      expect(snap?.copiedAt).toBeGreaterThanOrEqual(before);
      expect(snap?.copiedAt).toBeLessThanOrEqual(after);
    });

    it('computes correct bounding box for trace', () => {
      mgr.copy([makeTrace()], 'design-1');
      const snap = mgr.getSnapshot();
      expect(snap?.boundingBox).toEqual({ x: 0, y: 0, width: 10, height: 5 });
    });

    it('computes correct bounding box spanning mixed items', () => {
      const trace = makeTrace(); // points: (0,0)→(10,0)→(10,5)
      const inst = makeInstance(); // position: (15, 15)
      mgr.copy([trace, inst], 'design-1');
      const snap = mgr.getSnapshot();
      expect(snap?.boundingBox).toEqual({ x: 0, y: 0, width: 15, height: 15 });
    });
  });

  // -----------------------------------------------------------------------
  // Paste
  // -----------------------------------------------------------------------

  describe('paste', () => {
    it('returns null when clipboard is empty', () => {
      expect(mgr.paste({ x: 50, y: 50 })).toBeNull();
    });

    it('pastes with new UUIDs', () => {
      const trace = makeTrace();
      mgr.copy([trace], 'design-1');
      const result = mgr.paste({ x: 50, y: 50 });
      expect(result).not.toBeNull();
      expect(result?.items).toHaveLength(1);
      expect(result?.items[0].id).not.toBe(trace.id);
    });

    it('offsets items to target position (center of bbox)', () => {
      // Trace bbox center: (5, 2.5)
      mgr.copy([makeTrace()], 'design-1');
      const result = mgr.paste({ x: 50, y: 50 });
      const points = (result?.items[0].data as TraceData).points;
      // Original: (0,0),(10,0),(10,5) → offset (45, 47.5)
      expect(points[0].x).toBeCloseTo(45);
      expect(points[0].y).toBeCloseTo(47.5);
      expect(points[1].x).toBeCloseTo(55);
      expect(points[1].y).toBeCloseTo(47.5);
      expect(points[2].x).toBeCloseTo(55);
      expect(points[2].y).toBeCloseTo(52.5);
    });

    it('preserves layer assignments', () => {
      const trace = makeTrace({ layer: 'B.Cu' });
      mgr.copy([trace], 'design-1');
      const result = mgr.paste({ x: 0, y: 0 });
      expect(result?.items[0].layer).toBe('B.Cu');
    });

    it('preserves net assignments within same design', () => {
      const trace = makeTrace({ netId: 'net-42' });
      mgr.copy([trace], 'design-1');
      const result = mgr.paste({ x: 0, y: 0 }, 'design-1');
      expect(result?.items[0].netId).toBe('net-42');
    });

    it('clears net assignments when pasting cross-design', () => {
      const trace = makeTrace({ netId: 'net-42' });
      mgr.copy([trace], 'design-1');
      const result = mgr.paste({ x: 0, y: 0 }, 'design-2');
      expect(result?.items[0].netId).toBeUndefined();
    });

    it('preserves properties', () => {
      const inst = makeInstance();
      mgr.copy([inst], 'design-1');
      const result = mgr.paste({ x: 0, y: 0 }, 'design-1');
      expect(result?.items[0].properties).toEqual({ refDes: 'U1' });
    });

    it('returns correct offset', () => {
      mgr.copy([makeTrace()], 'design-1'); // bbox center: (5, 2.5)
      const result = mgr.paste({ x: 20, y: 30 });
      expect(result?.offset.dx).toBeCloseTo(15);
      expect(result?.offset.dy).toBeCloseTo(27.5);
    });

    it('can paste multiple times from same clipboard', () => {
      mgr.copy([makeTrace()], 'design-1');
      const r1 = mgr.paste({ x: 10, y: 10 });
      const r2 = mgr.paste({ x: 20, y: 20 });
      expect(r1).not.toBeNull();
      expect(r2).not.toBeNull();
      // Each paste has unique IDs
      expect(r1?.items[0].id).not.toBe(r2?.items[0].id);
    });

    it('offsets via position correctly', () => {
      const via = makeVia(); // position: (5, 5)
      mgr.copy([via], 'design-1'); // bbox center: (5, 5)
      const result = mgr.paste({ x: 30, y: 40 });
      const pos = (result?.items[0].data as ViaData).position;
      expect(pos.x).toBeCloseTo(30);
      expect(pos.y).toBeCloseTo(40);
    });

    it('offsets instance position correctly', () => {
      const inst = makeInstance(); // position: (15, 15)
      mgr.copy([inst], 'design-1'); // bbox center: (15, 15)
      const result = mgr.paste({ x: 100, y: 100 });
      const pos = (result?.items[0].data as InstanceData).position;
      expect(pos.x).toBeCloseTo(100);
      expect(pos.y).toBeCloseTo(100);
    });

    it('preserves instance rotation', () => {
      const inst = makeInstance(); // rotation: 90
      mgr.copy([inst], 'design-1');
      const result = mgr.paste({ x: 0, y: 0 });
      expect((result?.items[0].data as InstanceData).rotation).toBe(90);
    });
  });

  // -----------------------------------------------------------------------
  // canPaste
  // -----------------------------------------------------------------------

  describe('canPaste', () => {
    it('returns false when empty', () => {
      expect(mgr.canPaste()).toBe(false);
    });

    it('returns true after copy', () => {
      mgr.copy([makeTrace()], 'design-1');
      expect(mgr.canPaste()).toBe(true);
    });

    it('returns false after clear', () => {
      mgr.copy([makeTrace()], 'design-1');
      mgr.clear();
      expect(mgr.canPaste()).toBe(false);
    });
  });

  // -----------------------------------------------------------------------
  // Preview
  // -----------------------------------------------------------------------

  describe('getClipboardPreview', () => {
    it('returns empty array when clipboard is empty', () => {
      const preview = mgr.getClipboardPreview({ x: 0, y: 0 });
      expect(preview).toEqual([]);
    });

    it('returns items translated to cursor position', () => {
      mgr.copy([makeTrace()], 'design-1'); // bbox center: (5, 2.5)
      const preview = mgr.getClipboardPreview({ x: 100, y: 100 });
      expect(preview).toHaveLength(1);
      const points = (preview[0].data as TraceData).points;
      // offset = (95, 97.5)
      expect(points[0].x).toBeCloseTo(95);
      expect(points[0].y).toBeCloseTo(97.5);
    });

    it('returns correct number of items for multi-item clipboard', () => {
      mgr.copy([makeTrace(), makeVia(), makeZone()], 'design-1');
      const preview = mgr.getClipboardPreview({ x: 0, y: 0 });
      expect(preview).toHaveLength(3);
    });

    it('does not modify clipboard state', () => {
      mgr.copy([makeTrace()], 'design-1');
      const snapBefore = mgr.getSnapshot();
      mgr.getClipboardPreview({ x: 999, y: 999 });
      const snapAfter = mgr.getSnapshot();
      expect(snapBefore).toBe(snapAfter); // reference equality
    });

    it('translates zone polygon correctly', () => {
      const zone = makeZone(); // polygon: (0,0),(20,0),(20,10),(0,10) → center (10, 5)
      mgr.copy([zone], 'design-1');
      const preview = mgr.getClipboardPreview({ x: 10, y: 5 }); // same center → offset 0
      const poly = (preview[0].data as ZoneData).polygon;
      expect(poly[0]).toEqual({ x: 0, y: 0 });
      expect(poly[2]).toEqual({ x: 20, y: 10 });
    });
  });

  // -----------------------------------------------------------------------
  // Duplicate in place
  // -----------------------------------------------------------------------

  describe('duplicateInPlace', () => {
    it('returns null for empty items', () => {
      expect(mgr.duplicateInPlace([])).toBeNull();
    });

    it('returns items with new IDs', () => {
      const trace = makeTrace();
      const result = mgr.duplicateInPlace([trace]);
      expect(result).not.toBeNull();
      expect(result).toHaveLength(1);
      expect(result?.[0].id).not.toBe(trace.id);
    });

    it('applies default offset (2.54mm)', () => {
      const trace = makeTrace();
      const result = mgr.duplicateInPlace([trace]);
      const origPoints = (trace.data as TraceData).points;
      const newPoints = (result?.[0].data as TraceData).points;
      expect(newPoints[0].x).toBeCloseTo(origPoints[0].x + 2.54);
      expect(newPoints[0].y).toBeCloseTo(origPoints[0].y + 2.54);
    });

    it('applies custom offset', () => {
      const via = makeVia(); // position: (5, 5)
      const result = mgr.duplicateInPlace([via], { dx: 10, dy: -5 });
      const pos = (result?.[0].data as ViaData).position;
      expect(pos.x).toBeCloseTo(15);
      expect(pos.y).toBeCloseTo(0);
    });

    it('handles multiple items', () => {
      const items = [makeTrace(), makeVia(), makeInstance()];
      const result = mgr.duplicateInPlace(items);
      expect(result).toHaveLength(3);
      // All IDs are new and unique
      const ids = new Set(result?.map((r) => r.id));
      expect(ids.size).toBe(3);
    });
  });

  // -----------------------------------------------------------------------
  // Edge cases
  // -----------------------------------------------------------------------

  describe('edge cases', () => {
    it('handles single-point via as bbox (zero width/height)', () => {
      const via = makeVia(); // position: (5, 5)
      mgr.copy([via], 'design-1');
      const snap = mgr.getSnapshot();
      expect(snap?.boundingBox).toEqual({ x: 5, y: 5, width: 0, height: 0 });
    });

    it('handles cross-design paste with no source design id', () => {
      mgr.copy([makeTrace({ netId: 'net-1' })]);
      const result = mgr.paste({ x: 0, y: 0 }, 'design-2');
      // No sourceDesignId on clipboard → '' !== 'design-2', but '' is falsy
      // so cross-design check skips (only triggers when both are truthy)
      expect(result?.items[0].netId).toBe('net-1');
    });

    it('handles large coordinate offsets', () => {
      mgr.copy([makeTrace()], 'design-1');
      const result = mgr.paste({ x: 1e6, y: 1e6 });
      const points = (result?.items[0].data as TraceData).points;
      expect(points[0].x).toBeCloseTo(1e6 - 5);
      expect(points[0].y).toBeCloseTo(1e6 - 2.5);
    });

    it('clear on empty clipboard does not notify', () => {
      const listener = vi.fn();
      mgr.subscribe(listener);
      mgr.clear();
      expect(listener).not.toHaveBeenCalled();
    });

    it('preserves trace width through copy/paste', () => {
      const trace = makeTrace();
      (trace.data as TraceData).width = 0.5;
      mgr.copy([trace], 'design-1');
      const result = mgr.paste({ x: 0, y: 0 });
      expect((result?.items[0].data as TraceData).width).toBe(0.5);
    });

    it('preserves zone fillType through copy/paste', () => {
      const zone = makeZone();
      (zone.data as ZoneData).fillType = 'hatched';
      mgr.copy([zone], 'design-1');
      const result = mgr.paste({ x: 0, y: 0 });
      expect((result?.items[0].data as ZoneData).fillType).toBe('hatched');
    });

    it('preserves via diameters through copy/paste', () => {
      const via = makeVia();
      (via.data as ViaData).drillDiameter = 0.4;
      (via.data as ViaData).outerDiameter = 0.8;
      mgr.copy([via], 'design-1');
      const result = mgr.paste({ x: 0, y: 0 });
      expect((result?.items[0].data as ViaData).drillDiameter).toBe(0.4);
      expect((result?.items[0].data as ViaData).outerDiameter).toBe(0.8);
    });

    it('preserves instance packageType through copy/paste', () => {
      const inst = makeInstance();
      mgr.copy([inst], 'design-1');
      const result = mgr.paste({ x: 0, y: 0 });
      expect((result?.items[0].data as InstanceData).packageType).toBe('SOIC-8');
    });
  });

  // -----------------------------------------------------------------------
  // ID remapping
  // -----------------------------------------------------------------------

  describe('remapIds', () => {
    it('generates new UUIDs for all items', () => {
      const items = [makeTrace(), makeVia(), makeZone()];
      const originalIds = items.map((i) => i.id);
      const remapped = remapIds(items);
      expect(remapped).toHaveLength(3);
      remapped.forEach((item, idx) => {
        expect(item.id).not.toBe(originalIds[idx]);
      });
    });

    it('generates unique IDs (no collisions)', () => {
      const items = Array.from({ length: 100 }, () => makeTrace());
      const remapped = remapIds(items);
      const ids = new Set(remapped.map((i) => i.id));
      expect(ids.size).toBe(100);
    });

    it('preserves item data', () => {
      const trace = makeTrace();
      const remapped = remapIds([trace]);
      expect(remapped[0].type).toBe('trace');
      expect(remapped[0].layer).toBe(trace.layer);
      expect(remapped[0].netId).toBe(trace.netId);
    });

    it('deep-clones data (mutation safety)', () => {
      const trace = makeTrace();
      const remapped = remapIds([trace]);
      (trace.data as TraceData).points[0].x = 999;
      expect((remapped[0].data as TraceData).points[0].x).toBe(0);
    });

    it('deep-clones properties', () => {
      const inst = makeInstance();
      const remapped = remapIds([inst]);
      (inst.properties as Record<string, unknown>)['refDes'] = 'MUTATED';
      expect(remapped[0].properties['refDes']).toBe('U1');
    });
  });

  // -----------------------------------------------------------------------
  // Keyboard state machine (manager-level, not DOM)
  // -----------------------------------------------------------------------

  describe('keyboard workflow', () => {
    it('copy → paste workflow', () => {
      const items = [makeTrace(), makeVia()];
      mgr.copy(items, 'design-1');
      expect(mgr.canPaste()).toBe(true);
      const result = mgr.paste({ x: 50, y: 50 });
      expect(result?.items).toHaveLength(2);
    });

    it('copy → clear → paste returns null', () => {
      mgr.copy([makeTrace()], 'design-1');
      mgr.clear();
      expect(mgr.paste({ x: 0, y: 0 })).toBeNull();
    });

    it('copy → paste → paste (multiple pastes)', () => {
      mgr.copy([makeTrace()], 'design-1');
      const r1 = mgr.paste({ x: 10, y: 10 });
      const r2 = mgr.paste({ x: 20, y: 20 });
      expect(r1?.items[0].id).not.toBe(r2?.items[0].id);
    });

    it('duplicate in place does not affect clipboard', () => {
      mgr.copy([makeTrace()], 'design-1');
      const beforeCount = mgr.getItemCount();
      mgr.duplicateInPlace([makeVia()]);
      expect(mgr.getItemCount()).toBe(beforeCount);
    });

    it('re-copy overwrites previous clipboard', () => {
      mgr.copy([makeTrace()], 'design-1');
      mgr.copy([makeVia()], 'design-2');
      const snap = mgr.getSnapshot();
      expect(snap?.items).toHaveLength(1);
      expect(snap?.items[0].type).toBe('via');
      expect(snap?.sourceDesignId).toBe('design-2');
    });
  });
});

// ---------------------------------------------------------------------------
// Standalone helper tests
// ---------------------------------------------------------------------------

describe('computeBoundingBox', () => {
  it('returns zero bbox for empty items', () => {
    expect(computeBoundingBox([])).toEqual({ x: 0, y: 0, width: 0, height: 0 });
  });

  it('computes bbox for a single trace', () => {
    const bbox = computeBoundingBox([makeTrace()]);
    expect(bbox).toEqual({ x: 0, y: 0, width: 10, height: 5 });
  });

  it('computes bbox spanning multiple items', () => {
    const bbox = computeBoundingBox([makeTrace(), makeInstance()]);
    expect(bbox).toEqual({ x: 0, y: 0, width: 15, height: 15 });
  });

  it('handles zone polygon', () => {
    const bbox = computeBoundingBox([makeZone()]);
    expect(bbox).toEqual({ x: 0, y: 0, width: 20, height: 10 });
  });

  it('handles negative coordinates', () => {
    const item: ClipboardItem = {
      type: 'trace',
      id: 'test',
      data: {
        kind: 'trace',
        points: [{ x: -10, y: -5 }, { x: 10, y: 5 }],
        width: 0.25,
      },
      layer: 'F.Cu',
      properties: {},
    };
    const bbox = computeBoundingBox([item]);
    expect(bbox).toEqual({ x: -10, y: -5, width: 20, height: 10 });
  });
});

describe('computeOffset', () => {
  it('computes zero offset when target is at bbox center', () => {
    const bbox = { x: 0, y: 0, width: 10, height: 10 };
    const offset = computeOffset(bbox, { x: 5, y: 5 });
    expect(offset.dx).toBeCloseTo(0);
    expect(offset.dy).toBeCloseTo(0);
  });

  it('computes positive offset', () => {
    const bbox = { x: 0, y: 0, width: 10, height: 10 };
    const offset = computeOffset(bbox, { x: 50, y: 50 });
    expect(offset.dx).toBeCloseTo(45);
    expect(offset.dy).toBeCloseTo(45);
  });

  it('computes negative offset', () => {
    const bbox = { x: 10, y: 10, width: 10, height: 10 };
    const offset = computeOffset(bbox, { x: 0, y: 0 });
    expect(offset.dx).toBeCloseTo(-15);
    expect(offset.dy).toBeCloseTo(-15);
  });

  it('handles zero-size bbox (single point)', () => {
    const bbox = { x: 5, y: 5, width: 0, height: 0 };
    const offset = computeOffset(bbox, { x: 20, y: 30 });
    expect(offset.dx).toBeCloseTo(15);
    expect(offset.dy).toBeCloseTo(25);
  });
});
