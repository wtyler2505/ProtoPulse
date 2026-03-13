/**
 * Incremental ERC Tests
 *
 * Tests for DirtyTracker, ERCResultCache, runIncrementalERC,
 * and invalidation hooks added to erc-engine.ts.
 */

import { describe, it, expect, beforeEach } from 'vitest';
import {
  DirtyTracker,
  ERCResultCache,
  runIncrementalERC,
  runERC,
  onInstanceAdded,
  onInstanceRemoved,
  onInstanceModified,
  onWireAdded,
  onWireRemoved,
} from '../erc-engine';
import type { ERCInput } from '../erc-engine';
import type { ERCRule, ERCViolation } from '@shared/circuit-types';
import type { CircuitInstanceRow, CircuitNetRow, ComponentPart } from '@shared/schema';
import { DEFAULT_CIRCUIT_SETTINGS } from '@shared/circuit-types';

// ---------------------------------------------------------------------------
// Helpers (same factory style as erc-engine.test.ts)
// ---------------------------------------------------------------------------

function makeInstance(id: number, partId: number, x = 0, y = 0): CircuitInstanceRow {
  return {
    id,
    circuitId: 1,
    partId,
    subDesignId: null,
    referenceDesignator: `U${id}`,
    schematicX: x,
    schematicY: y,
    schematicRotation: 0,
    breadboardX: null,
    breadboardY: null,
    breadboardRotation: null,
    pcbX: null,
    pcbY: null,
    pcbRotation: null,
    pcbSide: null,
    properties: {},
    createdAt: new Date(),
  };
}

function makePart(
  id: number,
  family: string,
  connectors: { id: string; name: string }[],
): ComponentPart {
  return {
    id,
    projectId: 1,
    nodeId: null,
    meta: { title: `Part ${id}`, family, tags: [], mountingType: '', properties: [] },
    connectors: connectors.map((c) => ({
      id: c.id,
      name: c.name,
      connectorType: 'male' as const,
      shapeIds: {},
      terminalPositions: {},
    })),
    buses: [],
    views: {},
    constraints: [],
    version: 1,
    createdAt: new Date(),
    updatedAt: new Date(),
  };
}

function makeNet(
  id: number,
  name: string,
  netType: string,
  segments: { fromInstanceId: number; fromPin: string; toInstanceId: number; toPin: string }[],
): CircuitNetRow {
  return {
    id,
    circuitId: 1,
    name,
    netType,
    voltage: null,
    busWidth: null,
    segments,
    labels: [],
    style: {},
    createdAt: new Date(),
  };
}

function allRulesEnabled(severity: 'error' | 'warning' = 'warning'): ERCRule[] {
  return [
    { type: 'unconnected-pin', enabled: true, severity, description: '' },
    { type: 'no-connect-connected', enabled: true, severity, description: '' },
    { type: 'driver-conflict', enabled: true, severity: 'error', description: '' },
    { type: 'floating-input', enabled: true, severity, description: '' },
    { type: 'shorted-power', enabled: true, severity: 'error', description: '' },
    { type: 'missing-bypass-cap', enabled: true, severity, description: '' },
    { type: 'power-net-unnamed', enabled: true, severity, description: '' },
  ];
}

function baseInput(
  instances: CircuitInstanceRow[],
  nets: CircuitNetRow[],
  partsMap: Map<number, ComponentPart>,
): ERCInput {
  return {
    instances,
    nets,
    partsMap,
    settings: { ...DEFAULT_CIRCUIT_SETTINGS, noConnectMarkers: [] },
    rules: allRulesEnabled(),
  };
}

// ---------------------------------------------------------------------------
// DirtyTracker
// ---------------------------------------------------------------------------

describe('DirtyTracker', () => {
  let tracker: DirtyTracker;

  beforeEach(() => {
    tracker = new DirtyTracker();
  });

  it('starts with no dirty entities', () => {
    expect(tracker.dirtyNetCount).toBe(0);
    expect(tracker.dirtyInstanceCount).toBe(0);
    expect(tracker.isAllDirty).toBe(false);
  });

  it('marks a net as dirty', () => {
    tracker.markNetDirty(10);
    expect(tracker.getDirtyNets().has(10)).toBe(true);
    expect(tracker.dirtyNetCount).toBe(1);
  });

  it('marks an instance as dirty', () => {
    tracker.markInstanceDirty(5);
    expect(tracker.getDirtyInstances().has(5)).toBe(true);
    expect(tracker.dirtyInstanceCount).toBe(1);
  });

  it('deduplicates repeated dirty marks', () => {
    tracker.markNetDirty(10);
    tracker.markNetDirty(10);
    tracker.markNetDirty(10);
    expect(tracker.dirtyNetCount).toBe(1);
  });

  it('tracks multiple dirty nets and instances', () => {
    tracker.markNetDirty(1);
    tracker.markNetDirty(2);
    tracker.markNetDirty(3);
    tracker.markInstanceDirty(10);
    tracker.markInstanceDirty(20);
    expect(tracker.dirtyNetCount).toBe(3);
    expect(tracker.dirtyInstanceCount).toBe(2);
  });

  it('clears all dirty state', () => {
    tracker.markNetDirty(1);
    tracker.markInstanceDirty(2);
    tracker.markAllDirty();
    tracker.clearDirty();
    expect(tracker.dirtyNetCount).toBe(0);
    expect(tracker.dirtyInstanceCount).toBe(0);
    expect(tracker.isAllDirty).toBe(false);
  });

  it('markAllDirty sets the allDirty flag', () => {
    tracker.markAllDirty();
    expect(tracker.isAllDirty).toBe(true);
  });

  it('clearDirty resets the allDirty flag', () => {
    tracker.markAllDirty();
    tracker.clearDirty();
    expect(tracker.isAllDirty).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// ERCResultCache
// ---------------------------------------------------------------------------

describe('ERCResultCache', () => {
  let cache: ERCResultCache;

  const makeViolation = (id: string, ruleType: 'unconnected-pin' | 'driver-conflict' = 'unconnected-pin'): ERCViolation => ({
    id,
    ruleType,
    severity: 'warning',
    message: `Test violation ${id}`,
    location: { x: 0, y: 0 },
  });

  beforeEach(() => {
    cache = new ERCResultCache();
  });

  it('starts empty', () => {
    expect(cache.size).toBe(0);
    expect(cache.getAllCachedResults()).toHaveLength(0);
  });

  it('stores and retrieves results by entity key', () => {
    const violations = [makeViolation('v1')];
    cache.setResults('net:10', violations);
    expect(cache.getResults('net:10')).toEqual(violations);
  });

  it('returns undefined for unknown keys', () => {
    expect(cache.getResults('net:999')).toBeUndefined();
  });

  it('overwrites results for the same key', () => {
    cache.setResults('inst:1', [makeViolation('old')]);
    cache.setResults('inst:1', [makeViolation('new')]);
    const results = cache.getResults('inst:1')!;
    expect(results).toHaveLength(1);
    expect(results[0].id).toBe('new');
  });

  it('invalidates a single entity key', () => {
    cache.setResults('net:10', [makeViolation('v1')]);
    cache.setResults('net:20', [makeViolation('v2')]);
    cache.invalidate('net:10');
    expect(cache.has('net:10')).toBe(false);
    expect(cache.has('net:20')).toBe(true);
  });

  it('invalidates all cached results', () => {
    cache.setResults('net:10', [makeViolation('v1')]);
    cache.setResults('inst:1', [makeViolation('v2')]);
    cache.invalidateAll();
    expect(cache.size).toBe(0);
    expect(cache.getAllCachedResults()).toHaveLength(0);
  });

  it('getAllCachedResults returns all violations across keys', () => {
    cache.setResults('net:10', [makeViolation('v1'), makeViolation('v2')]);
    cache.setResults('inst:1', [makeViolation('v3')]);
    const all = cache.getAllCachedResults();
    expect(all).toHaveLength(3);
    expect(all.map((v) => v.id).sort()).toEqual(['v1', 'v2', 'v3']);
  });

  it('has() returns correct boolean', () => {
    expect(cache.has('net:10')).toBe(false);
    cache.setResults('net:10', []);
    expect(cache.has('net:10')).toBe(true);
  });

  it('stores empty arrays (no violations for clean entity)', () => {
    cache.setResults('inst:5', []);
    expect(cache.has('inst:5')).toBe(true);
    expect(cache.getResults('inst:5')).toEqual([]);
    expect(cache.size).toBe(1);
  });
});

// ---------------------------------------------------------------------------
// runIncrementalERC
// ---------------------------------------------------------------------------

describe('runIncrementalERC', () => {
  let tracker: DirtyTracker;
  let cache: ERCResultCache;

  beforeEach(() => {
    tracker = new DirtyTracker();
    cache = new ERCResultCache();
  });

  it('falls back to full run on first invocation (empty cache)', () => {
    const part = makePart(1, 'ic', [{ id: 'pin1', name: 'CLK' }]);
    const inst = makeInstance(1, 1);
    const partsMap = new Map([[1, part]]);
    const input = baseInput([inst], [], partsMap);

    const violations = runIncrementalERC(input, tracker, cache);
    const fullViolations = runERC(input);

    // Should produce identical results to a full run
    expect(violations.map((v) => v.id).sort()).toEqual(fullViolations.map((v) => v.id).sort());
    // Cache should be populated
    expect(cache.size).toBeGreaterThan(0);
  });

  it('returns cached results when nothing is dirty', () => {
    const part1 = makePart(1, 'ic', [{ id: 'tx', name: 'TX' }]);
    const part2 = makePart(2, 'ic', [{ id: 'rx', name: 'RX' }]);
    const inst1 = makeInstance(1, 1);
    const inst2 = makeInstance(2, 2);
    const partsMap = new Map([[1, part1], [2, part2]]);
    const net = makeNet(10, 'UART', 'signal', [
      { fromInstanceId: 1, fromPin: 'tx', toInstanceId: 2, toPin: 'rx' },
    ]);
    const input = baseInput([inst1, inst2], [net], partsMap);

    // First run (populates cache)
    const first = runIncrementalERC(input, tracker, cache);
    // Second run — nothing dirty → should return same results from cache
    const second = runIncrementalERC(input, tracker, cache);

    expect(second.map((v) => v.id).sort()).toEqual(first.map((v) => v.id).sort());
  });

  it('re-checks only dirty entities', () => {
    // Circuit: 3 instances, 2 nets — first run populates everything
    const part1 = makePart(1, 'ic', [{ id: 'tx', name: 'TX' }]);
    const part2 = makePart(2, 'ic', [{ id: 'rx', name: 'RX' }]);
    const part3 = makePart(3, 'ic', [{ id: 'pin1', name: 'CLK' }]);
    const inst1 = makeInstance(1, 1);
    const inst2 = makeInstance(2, 2);
    const inst3 = makeInstance(3, 3);
    const partsMap = new Map([[1, part1], [2, part2], [3, part3]]);
    const net1 = makeNet(10, 'UART', 'signal', [
      { fromInstanceId: 1, fromPin: 'tx', toInstanceId: 2, toPin: 'rx' },
    ]);
    const input = baseInput([inst1, inst2, inst3], [net1], partsMap);

    // Populate cache
    runIncrementalERC(input, tracker, cache);

    // Mark only instance 3 dirty (it has an unconnected pin)
    tracker.markInstanceDirty(3);
    const results = runIncrementalERC(input, tracker, cache);

    // Should still contain instance 3's unconnected-pin violation
    expect(results.some((v) => v.instanceId === 3 && v.ruleType === 'unconnected-pin')).toBe(true);
  });

  it('falls back to full ERC when >50% of entities are dirty', () => {
    // 2 instances, 1 net = 3 total entities. Mark 2 dirty = 66% > 50%
    const part1 = makePart(1, 'ic', [{ id: 'pin1', name: 'CLK' }]);
    const part2 = makePart(2, 'ic', [{ id: 'pin1', name: 'CLK' }]);
    const inst1 = makeInstance(1, 1);
    const inst2 = makeInstance(2, 2);
    const partsMap = new Map([[1, part1], [2, part2]]);
    const net = makeNet(10, 'CLK_NET', 'signal', [
      { fromInstanceId: 1, fromPin: 'pin1', toInstanceId: 2, toPin: 'pin1' },
    ]);
    const input = baseInput([inst1, inst2], [net], partsMap);

    // Populate cache
    runIncrementalERC(input, tracker, cache);

    // Mark 2 of 3 entities dirty — should trigger full fallback
    tracker.markInstanceDirty(1);
    tracker.markInstanceDirty(2);
    const results = runIncrementalERC(input, tracker, cache);
    const fullResults = runERC(input);

    expect(results.map((v) => v.id).sort()).toEqual(fullResults.map((v) => v.id).sort());
  });

  it('falls back to full ERC when markAllDirty() was called', () => {
    const part = makePart(1, 'ic', [{ id: 'pin1', name: 'CLK' }]);
    const inst = makeInstance(1, 1);
    const partsMap = new Map([[1, part]]);
    const input = baseInput([inst], [], partsMap);

    // Populate cache
    runIncrementalERC(input, tracker, cache);

    tracker.markAllDirty();
    const results = runIncrementalERC(input, tracker, cache);
    const fullResults = runERC(input);

    expect(results.map((v) => v.id).sort()).toEqual(fullResults.map((v) => v.id).sort());
  });

  it('clears dirty flags after incremental run', () => {
    const part = makePart(1, 'ic', [{ id: 'pin1', name: 'CLK' }]);
    const inst = makeInstance(1, 1);
    const partsMap = new Map([[1, part]]);
    const input = baseInput([inst], [], partsMap);

    tracker.markInstanceDirty(1);
    runIncrementalERC(input, tracker, cache);

    expect(tracker.dirtyInstanceCount).toBe(0);
    expect(tracker.dirtyNetCount).toBe(0);
    expect(tracker.isAllDirty).toBe(false);
  });

  it('handles empty circuit', () => {
    const input = baseInput([], [], new Map());
    const results = runIncrementalERC(input, tracker, cache);
    expect(results).toHaveLength(0);
  });

  it('handles all dirty equivalent to full run', () => {
    const part = makePart(1, 'ic', [{ id: 'pin1', name: 'CLK' }]);
    const inst = makeInstance(1, 1);
    const partsMap = new Map([[1, part]]);
    const input = baseInput([inst], [], partsMap);

    // First run populates cache
    runIncrementalERC(input, tracker, cache);

    // Mark the only instance dirty (1 of 1 = 100% > threshold)
    tracker.markInstanceDirty(1);
    const results = runIncrementalERC(input, tracker, cache);
    const fullResults = runERC(input);

    expect(results.map((v) => v.id).sort()).toEqual(fullResults.map((v) => v.id).sort());
  });

  it('respects custom dirtyThreshold', () => {
    // 4 instances, 2 nets = 6 entities. Mark 2 dirty = 33%
    // Default threshold (50%) → incremental. Custom threshold (0.3) → full.
    const parts = Array.from({ length: 4 }, (_, i) =>
      makePart(i + 1, 'ic', [{ id: 'pin1', name: 'CLK' }]),
    );
    const instances = parts.map((p, i) => makeInstance(i + 1, p.id));
    const partsMap = new Map(parts.map((p) => [p.id, p]));
    const net1 = makeNet(10, 'NET1', 'signal', [
      { fromInstanceId: 1, fromPin: 'pin1', toInstanceId: 2, toPin: 'pin1' },
    ]);
    const net2 = makeNet(11, 'NET2', 'signal', [
      { fromInstanceId: 3, fromPin: 'pin1', toInstanceId: 4, toPin: 'pin1' },
    ]);
    const input = baseInput(instances, [net1, net2], partsMap);

    // Populate cache
    runIncrementalERC(input, tracker, cache);
    const cacheAfterFirst = cache.size;

    // Mark 2 of 6 dirty = 33%
    tracker.markInstanceDirty(1);
    tracker.markInstanceDirty(2);

    // With threshold 0.3 (30%), 33% > 30% → full fallback
    runIncrementalERC(input, tracker, cache, { dirtyThreshold: 0.3 });
    // Full fallback should re-populate the entire cache
    expect(cache.size).toBeGreaterThanOrEqual(cacheAfterFirst);
  });

  it('produces correct results when a net gains a new violation', () => {
    // Start with clean circuit (TX → RX), then simulate adding a second output
    const part1 = makePart(1, 'ic', [{ id: 'tx', name: 'TX' }]);
    const part2 = makePart(2, 'ic', [{ id: 'rx', name: 'RX' }]);
    const inst1 = makeInstance(1, 1);
    const inst2 = makeInstance(2, 2);
    const partsMap = new Map([[1, part1], [2, part2]]);
    const net = makeNet(10, 'DATA', 'signal', [
      { fromInstanceId: 1, fromPin: 'tx', toInstanceId: 2, toPin: 'rx' },
    ]);
    const input1 = baseInput([inst1, inst2], [net], partsMap);

    // Populate cache — no driver conflict
    runIncrementalERC(input1, tracker, cache);

    // Now add a third instance with MISO (output) to the same net — driver conflict
    const part3 = makePart(3, 'ic', [{ id: 'miso', name: 'MISO' }]);
    const inst3 = makeInstance(3, 3);
    partsMap.set(3, part3);
    const netWithConflict = makeNet(10, 'DATA', 'signal', [
      { fromInstanceId: 1, fromPin: 'tx', toInstanceId: 2, toPin: 'rx' },
      { fromInstanceId: 2, fromPin: 'rx', toInstanceId: 3, toPin: 'miso' },
    ]);
    const input2 = baseInput([inst1, inst2, inst3], [netWithConflict], partsMap);

    tracker.markNetDirty(10);
    tracker.markInstanceDirty(3);
    const results = runIncrementalERC(input2, tracker, cache);

    expect(results.some((v) => v.ruleType === 'driver-conflict')).toBe(true);
  });

  it('deduplicates violations that appear in multiple entity caches', () => {
    // A violation with both netId and instanceId would be cached under both keys.
    // The result should not contain duplicates.
    const part1 = makePart(1, 'ic', [{ id: 'tx', name: 'TX' }]);
    const part2 = makePart(2, 'ic', [{ id: 'tx2', name: 'TX' }]);
    const inst1 = makeInstance(1, 1);
    const inst2 = makeInstance(2, 2);
    const partsMap = new Map([[1, part1], [2, part2]]);
    const net = makeNet(10, 'BUS', 'signal', [
      { fromInstanceId: 1, fromPin: 'tx', toInstanceId: 2, toPin: 'tx2' },
    ]);
    const input = baseInput([inst1, inst2], [net], partsMap);

    const results = runIncrementalERC(input, tracker, cache);
    const ids = results.map((v) => v.id);
    const uniqueIds = Array.from(new Set(ids));

    expect(ids.length).toBe(uniqueIds.length);
  });
});

// ---------------------------------------------------------------------------
// Invalidation hooks
// ---------------------------------------------------------------------------

describe('invalidation hooks', () => {
  let tracker: DirtyTracker;

  beforeEach(() => {
    tracker = new DirtyTracker();
  });

  it('onInstanceAdded marks instance dirty', () => {
    onInstanceAdded(tracker, 42);
    expect(tracker.getDirtyInstances().has(42)).toBe(true);
  });

  it('onInstanceRemoved marks instance dirty', () => {
    onInstanceRemoved(tracker, 7);
    expect(tracker.getDirtyInstances().has(7)).toBe(true);
  });

  it('onInstanceModified marks instance dirty', () => {
    onInstanceModified(tracker, 99);
    expect(tracker.getDirtyInstances().has(99)).toBe(true);
  });

  it('onWireAdded marks the net dirty', () => {
    onWireAdded(tracker, 100, 10);
    expect(tracker.getDirtyNets().has(10)).toBe(true);
  });

  it('onWireRemoved marks the net dirty', () => {
    onWireRemoved(tracker, 200, 20);
    expect(tracker.getDirtyNets().has(20)).toBe(true);
  });

  it('multiple hooks accumulate dirty state', () => {
    onInstanceAdded(tracker, 1);
    onInstanceModified(tracker, 2);
    onWireAdded(tracker, 100, 10);
    onWireRemoved(tracker, 200, 20);
    expect(tracker.dirtyInstanceCount).toBe(2);
    expect(tracker.dirtyNetCount).toBe(2);
  });
});

// ---------------------------------------------------------------------------
// Performance: incremental should be equivalent to full for correctness
// ---------------------------------------------------------------------------

describe('incremental ERC correctness equivalence', () => {
  it('incremental with 1 dirty net in a multi-net circuit matches full results', () => {
    // Build a circuit with multiple nets
    const parts: ComponentPart[] = [];
    const instances: CircuitInstanceRow[] = [];
    const nets: CircuitNetRow[] = [];
    const partsMap = new Map<number, ComponentPart>();

    // Create 10 pairs of instances connected by nets
    for (let i = 0; i < 20; i++) {
      const part = makePart(i + 1, 'ic', [{ id: 'pin1', name: i % 2 === 0 ? 'TX' : 'RX' }]);
      parts.push(part);
      partsMap.set(part.id, part);
      instances.push(makeInstance(i + 1, part.id));
    }
    for (let i = 0; i < 10; i++) {
      nets.push(
        makeNet(100 + i, `NET_${i}`, 'signal', [
          { fromInstanceId: i * 2 + 1, fromPin: 'pin1', toInstanceId: i * 2 + 2, toPin: 'pin1' },
        ]),
      );
    }

    const input = baseInput(instances, nets, partsMap);
    const tracker = new DirtyTracker();
    const cache = new ERCResultCache();

    // Full initial run
    runIncrementalERC(input, tracker, cache);

    // Mark just 1 net dirty
    tracker.markNetDirty(100);
    const incremental = runIncrementalERC(input, tracker, cache);
    const full = runERC(input);

    // Both should produce the same violations (possibly in different order)
    expect(incremental.map((v) => v.id).sort()).toEqual(full.map((v) => v.id).sort());
  });

  it('incremental with no dirty entities returns all cached results unchanged', () => {
    const part1 = makePart(1, 'ic', [{ id: 'pin1', name: 'CLK' }]);
    const part2 = makePart(2, 'ic', [{ id: 'pin1', name: 'CLK' }]);
    const inst1 = makeInstance(1, 1);
    const inst2 = makeInstance(2, 2);
    const partsMap = new Map([[1, part1], [2, part2]]);
    const net = makeNet(10, 'CLK', 'signal', [
      { fromInstanceId: 1, fromPin: 'pin1', toInstanceId: 2, toPin: 'pin1' },
    ]);
    const input = baseInput([inst1, inst2], [net], partsMap);
    const tracker = new DirtyTracker();
    const cache = new ERCResultCache();

    // Initial
    const first = runIncrementalERC(input, tracker, cache);
    // No dirty → pure cache return
    const second = runIncrementalERC(input, tracker, cache);

    expect(second).toEqual(first);
  });
});
