/**
 * NetPadMapper — Tests for net-to-pad resolution and ratsnest generation.
 *
 * Validates:
 *   - Pad position computation (translation + rotation)
 *   - Net-to-pad mapping from circuit segments
 *   - Minimum spanning tree ratsnest pair generation
 *   - Unmapped pin detection
 *   - Edge cases (empty nets, single-pad nets, missing footprints)
 */

import { describe, expect, it } from 'vitest';
import type { CircuitInstanceRow } from '@shared/schema';
import type { Footprint, Pad } from '@/lib/pcb/footprint-library';
import { NetPadMapper } from '@/lib/pcb/net-pad-mapper';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Create a minimal CircuitInstanceRow for testing. */
function makeInstance(overrides: Partial<CircuitInstanceRow> & { id: number }): CircuitInstanceRow {
  return {
    circuitId: 1,
    partId: null,
    referenceDesignator: `U${String(overrides.id)}`,
    schematicX: 0,
    schematicY: 0,
    schematicRotation: 0,
    breadboardX: null,
    breadboardY: null,
    breadboardRotation: 0,
    pcbX: null,
    pcbY: null,
    pcbRotation: 0,
    pcbSide: 'front',
    benchX: null,
    benchY: null,
    properties: { package: '0805' },
    createdAt: new Date(),
    ...overrides,
  } as CircuitInstanceRow;
}

function makePad(num: number, x: number, y: number): Pad {
  return {
    number: num,
    type: 'smd',
    shape: 'rect',
    position: { x, y },
    width: 1.2,
    height: 1.4,
    layer: 'front',
  };
}

/** A simple 2-pad footprint (e.g., a resistor). */
const resistorFootprint: Footprint = {
  packageType: '0805',
  description: '0805 imperial (2012 metric) chip',
  pinCount: 2,
  pads: [
    makePad(1, -1.0, 0),
    makePad(2, 1.0, 0),
  ],
  courtyard: { x: -1.7, y: -0.9, width: 3.4, height: 1.8 },
  boundingBox: { x: -1.6, y: -0.7, width: 3.2, height: 1.4 },
  silkscreen: [],
  mountingType: 'smd',
};

/** A 3-pad footprint (e.g., SOT-23 transistor). */
const sot23Footprint: Footprint = {
  packageType: 'SOT-23',
  description: 'SOT-23 3-pin transistor',
  pinCount: 3,
  pads: [
    makePad(1, -0.95, 1.0),
    makePad(2, 0.95, 1.0),
    makePad(3, 0, -1.0),
  ],
  courtyard: { x: -1.3, y: -1.5, width: 2.6, height: 3.0 },
  boundingBox: { x: -1.55, y: -1.7, width: 3.1, height: 3.4 },
  silkscreen: [],
  mountingType: 'smd',
};

type NetRecord = { id: number; name: string; segments: unknown };

function getFootprintForTests(packageType: string): Footprint | null {
  if (packageType === '0805') { return resistorFootprint; }
  if (packageType === 'SOT-23') { return sot23Footprint; }
  return null;
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('NetPadMapper', () => {
  describe('rotation math', () => {
    it('should not change position at 0 degrees', () => {
      const inst = makeInstance({ id: 1, pcbX: 10, pcbY: 20, pcbRotation: 0 });
      const nets: NetRecord[] = [{
        id: 1,
        name: 'N1',
        segments: [{ fromInstanceId: 1, fromPin: '1', toInstanceId: 1, toPin: '2' }],
      }];

      const result = NetPadMapper.resolve(nets, [inst], getFootprintForTests);

      const pads = result.netPads.get(1);
      expect(pads).toBeDefined();
      // Pad 1 at (-1.0, 0) + instance at (10, 20) -> (9.0, 20)
      const pad1 = pads!.find((p) => p.padNumber === 1);
      expect(pad1).toBeDefined();
      expect(pad1!.position.x).toBeCloseTo(9.0, 4);
      expect(pad1!.position.y).toBeCloseTo(20, 4);
    });

    it('should rotate pad 90 degrees correctly', () => {
      // Pad at (2.54, 0) rotated 90 degrees -> (0, 2.54)
      const inst = makeInstance({ id: 1, pcbX: 0, pcbY: 0, pcbRotation: 90, properties: { package: 'CUSTOM' } });
      const customFp: Footprint = {
        packageType: 'CUSTOM',
        description: 'test',
        pinCount: 2,
        pads: [
          makePad(1, 2.54, 0),
          makePad(2, -2.54, 0),
        ],
        courtyard: { x: -3, y: -1, width: 6, height: 2 },
        boundingBox: { x: -3.14, y: -0.7, width: 6.28, height: 1.4 },
        silkscreen: [],
        mountingType: 'smd',
      };

      const nets: NetRecord[] = [{
        id: 1,
        name: 'N1',
        segments: [{ fromInstanceId: 1, fromPin: '1', toInstanceId: 1, toPin: '2' }],
      }];

      const result = NetPadMapper.resolve(
        nets,
        [inst],
        (pkg) => pkg === 'CUSTOM' ? customFp : null,
      );

      const pad1 = result.netPads.get(1)!.find((p) => p.padNumber === 1);
      expect(pad1).toBeDefined();
      expect(pad1!.position.x).toBeCloseTo(0, 4);
      expect(pad1!.position.y).toBeCloseTo(2.54, 4);
    });

    it('should rotate pad 180 degrees correctly', () => {
      const inst = makeInstance({ id: 1, pcbX: 5, pcbY: 5, pcbRotation: 180 });
      const nets: NetRecord[] = [{
        id: 1,
        name: 'N1',
        segments: [{ fromInstanceId: 1, fromPin: '1', toInstanceId: 1, toPin: '2' }],
      }];

      const result = NetPadMapper.resolve(nets, [inst], getFootprintForTests);

      // Pad 1 at (-1.0, 0) rotated 180 -> (1.0, 0) + instance (5, 5) -> (6.0, 5)
      const pad1 = result.netPads.get(1)!.find((p) => p.padNumber === 1);
      expect(pad1).toBeDefined();
      expect(pad1!.position.x).toBeCloseTo(6.0, 4);
      expect(pad1!.position.y).toBeCloseTo(5, 4);
    });

    it('should rotate pad 270 degrees correctly', () => {
      const inst = makeInstance({ id: 1, pcbX: 0, pcbY: 0, pcbRotation: 270, properties: { package: 'CUSTOM' } });
      const customFp: Footprint = {
        packageType: 'CUSTOM',
        description: 'test',
        pinCount: 1,
        pads: [makePad(1, 2.54, 0)],
        courtyard: { x: -2, y: -1, width: 4, height: 2 },
        boundingBox: { x: -3.14, y: -0.7, width: 6.28, height: 1.4 },
        silkscreen: [],
        mountingType: 'smd',
      };

      const nets: NetRecord[] = [{
        id: 1,
        name: 'N1',
        segments: [{ fromInstanceId: 1, fromPin: '1', toInstanceId: 1, toPin: '1' }],
      }];

      const result = NetPadMapper.resolve(
        nets,
        [inst],
        (pkg) => pkg === 'CUSTOM' ? customFp : null,
      );

      // (2.54, 0) rotated 270 -> (0, -2.54)
      const pad1 = result.netPads.get(1)!.find((p) => p.padNumber === 1);
      expect(pad1).toBeDefined();
      expect(pad1!.position.x).toBeCloseTo(0, 4);
      expect(pad1!.position.y).toBeCloseTo(-2.54, 4);
    });
  });

  describe('net-to-pad resolution', () => {
    it('should resolve a single net with 2 instances to 2 pads and 1 ratsnest pair', () => {
      const instances = [
        makeInstance({ id: 1, pcbX: 0, pcbY: 0, pcbRotation: 0 }),
        makeInstance({ id: 2, pcbX: 20, pcbY: 0, pcbRotation: 0 }),
      ];

      const nets: NetRecord[] = [{
        id: 10,
        name: 'VCC',
        segments: [{ fromInstanceId: 1, fromPin: '2', toInstanceId: 2, toPin: '1' }],
      }];

      const result = NetPadMapper.resolve(nets, instances, getFootprintForTests);

      // Net 10 should have 2 pads
      const pads = result.netPads.get(10);
      expect(pads).toBeDefined();
      expect(pads!.length).toBe(2);

      // Verify pad positions
      const fromPad = pads!.find((p) => p.instanceId === 1);
      expect(fromPad).toBeDefined();
      expect(fromPad!.padNumber).toBe(2);
      expect(fromPad!.position.x).toBeCloseTo(1.0, 4); // pad 2 at (1.0, 0) + instance at (0, 0)

      const toPad = pads!.find((p) => p.instanceId === 2);
      expect(toPad).toBeDefined();
      expect(toPad!.padNumber).toBe(1);
      expect(toPad!.position.x).toBeCloseTo(19.0, 4); // pad 1 at (-1.0, 0) + instance at (20, 0)

      // 1 ratsnest pair
      expect(result.ratsnestPairs.length).toBe(1);
      expect(result.ratsnestPairs[0].netId).toBe(10);
      expect(result.ratsnestPairs[0].distance).toBeCloseTo(18.0, 4);
    });

    it('should resolve a net with 3 instances using MST (N-1 pairs)', () => {
      const instances = [
        makeInstance({ id: 1, pcbX: 0, pcbY: 0, pcbRotation: 0 }),
        makeInstance({ id: 2, pcbX: 10, pcbY: 0, pcbRotation: 0 }),
        makeInstance({ id: 3, pcbX: 5, pcbY: 8.66, pcbRotation: 0 }),
      ];

      const nets: NetRecord[] = [{
        id: 20,
        name: 'GND',
        segments: [
          { fromInstanceId: 1, fromPin: '1', toInstanceId: 2, toPin: '1' },
          { fromInstanceId: 2, fromPin: '1', toInstanceId: 3, toPin: '1' },
        ],
      }];

      const result = NetPadMapper.resolve(nets, instances, getFootprintForTests);

      const pads = result.netPads.get(20);
      expect(pads).toBeDefined();
      // 3 unique pads (from 3 instances)
      expect(pads!.length).toBeGreaterThanOrEqual(3);

      // MST of 3 nodes = 2 edges (N-1)
      const netRatsnest = result.ratsnestPairs.filter((r) => r.netId === 20);
      expect(netRatsnest.length).toBe(2);
    });

    it('should handle multiple nets independently', () => {
      const instances = [
        makeInstance({ id: 1, pcbX: 0, pcbY: 0, pcbRotation: 0 }),
        makeInstance({ id: 2, pcbX: 10, pcbY: 0, pcbRotation: 0 }),
        makeInstance({ id: 3, pcbX: 20, pcbY: 0, pcbRotation: 0 }),
      ];

      const nets: NetRecord[] = [
        {
          id: 1,
          name: 'NET1',
          segments: [{ fromInstanceId: 1, fromPin: '1', toInstanceId: 2, toPin: '2' }],
        },
        {
          id: 2,
          name: 'NET2',
          segments: [{ fromInstanceId: 2, fromPin: '1', toInstanceId: 3, toPin: '2' }],
        },
      ];

      const result = NetPadMapper.resolve(nets, instances, getFootprintForTests);

      expect(result.netPads.get(1)).toBeDefined();
      expect(result.netPads.get(2)).toBeDefined();
      expect(result.netPads.get(1)!.length).toBe(2);
      expect(result.netPads.get(2)!.length).toBe(2);
      expect(result.ratsnestPairs.length).toBe(2); // 1 per net
    });
  });

  describe('unmapped pins', () => {
    it('should track unmapped pins when no footprint is found', () => {
      const instances = [
        makeInstance({ id: 1, pcbX: 0, pcbY: 0, pcbRotation: 0 }),
        makeInstance({ id: 2, pcbX: 10, pcbY: 0, pcbRotation: 0 }),
      ];

      const nets: NetRecord[] = [{
        id: 5,
        name: 'SIG',
        segments: [{ fromInstanceId: 1, fromPin: '1', toInstanceId: 2, toPin: '1' }],
      }];

      // Return null for all footprints -> all pins unmapped
      const result = NetPadMapper.resolve(nets, instances, () => null);

      expect(result.unmappedPins.length).toBe(2);
      expect(result.unmappedPins.some((p) => p.instanceId === 1 && p.pinName === '1')).toBe(true);
      expect(result.unmappedPins.some((p) => p.instanceId === 2 && p.pinName === '1')).toBe(true);
      expect(result.ratsnestPairs.length).toBe(0);
    });

    it('should track unmapped pins when pad number does not match', () => {
      const instances = [
        makeInstance({ id: 1, pcbX: 0, pcbY: 0, pcbRotation: 0 }),
      ];

      const nets: NetRecord[] = [{
        id: 6,
        name: 'SIG',
        // Pin name "99" won't match any pad in the 0805 footprint (only has 1 and 2)
        segments: [{ fromInstanceId: 1, fromPin: '99', toInstanceId: 1, toPin: '1' }],
      }];

      const result = NetPadMapper.resolve(nets, instances, getFootprintForTests);

      // Pin "99" should be unmapped, pin "1" should be mapped
      expect(result.unmappedPins.some((p) => p.pinName === '99')).toBe(true);
      expect(result.netPads.get(6)!.some((p) => p.padNumber === 1)).toBe(true);
    });

    it('should track unmapped pins when instance has no PCB coordinates', () => {
      const instances = [
        makeInstance({ id: 1 }), // no pcbX/pcbY -> not placed
        makeInstance({ id: 2, pcbX: 10, pcbY: 0, pcbRotation: 0 }),
      ];

      const nets: NetRecord[] = [{
        id: 7,
        name: 'SIG',
        segments: [{ fromInstanceId: 1, fromPin: '1', toInstanceId: 2, toPin: '1' }],
      }];

      const result = NetPadMapper.resolve(nets, instances, getFootprintForTests);

      // Instance 1 has no PCB coordinates -> pin is unmapped
      expect(result.unmappedPins.some((p) => p.instanceId === 1)).toBe(true);
      // Instance 2 is placed -> pad is resolved
      expect(result.netPads.get(7)!.some((p) => p.instanceId === 2)).toBe(true);
    });
  });

  describe('edge cases', () => {
    it('should return empty result for empty nets array', () => {
      const result = NetPadMapper.resolve([], [], getFootprintForTests);

      expect(result.netPads.size).toBe(0);
      expect(result.ratsnestPairs.length).toBe(0);
      expect(result.unmappedPins.length).toBe(0);
    });

    it('should handle net with only 1 pad -- no ratsnest pair, pad still in netPads', () => {
      const instances = [
        makeInstance({ id: 1, pcbX: 5, pcbY: 5, pcbRotation: 0 }),
      ];

      // A net segment where toInstance doesn't exist
      const nets: NetRecord[] = [{
        id: 30,
        name: 'ORPHAN',
        segments: [{ fromInstanceId: 1, fromPin: '1', toInstanceId: 999, toPin: '1' }],
      }];

      const result = NetPadMapper.resolve(nets, instances, getFootprintForTests);

      const pads = result.netPads.get(30);
      expect(pads).toBeDefined();
      expect(pads!.length).toBe(1);
      expect(pads![0].instanceId).toBe(1);

      // No ratsnest pair (need at least 2 pads)
      const netRatsnest = result.ratsnestPairs.filter((r) => r.netId === 30);
      expect(netRatsnest.length).toBe(0);
    });

    it('should handle net with no segments', () => {
      const nets: NetRecord[] = [{
        id: 40,
        name: 'EMPTY',
        segments: [],
      }];

      const result = NetPadMapper.resolve(nets, [], getFootprintForTests);

      // No segments processed, so no pads for this net
      expect(result.netPads.has(40)).toBe(false);
      expect(result.ratsnestPairs.length).toBe(0);
    });

    it('should handle null segments gracefully', () => {
      const nets: NetRecord[] = [{
        id: 41,
        name: 'NULL_SEG',
        segments: null,
      }];

      const result = NetPadMapper.resolve(nets, [], getFootprintForTests);

      expect(result.ratsnestPairs.length).toBe(0);
    });

    it('should deduplicate pads when same instance+pad appears in multiple segments', () => {
      const instances = [
        makeInstance({ id: 1, pcbX: 0, pcbY: 0, pcbRotation: 0 }),
        makeInstance({ id: 2, pcbX: 10, pcbY: 0, pcbRotation: 0 }),
        makeInstance({ id: 3, pcbX: 20, pcbY: 0, pcbRotation: 0 }),
      ];

      // Instance 1 pad "1" appears in two segments of the same net
      const nets: NetRecord[] = [{
        id: 50,
        name: 'SHARED',
        segments: [
          { fromInstanceId: 1, fromPin: '1', toInstanceId: 2, toPin: '1' },
          { fromInstanceId: 1, fromPin: '1', toInstanceId: 3, toPin: '1' },
        ],
      }];

      const result = NetPadMapper.resolve(nets, instances, getFootprintForTests);

      const pads = result.netPads.get(50);
      expect(pads).toBeDefined();
      // Should have 3 unique pads (not 4 with duplicate)
      expect(pads!.length).toBe(3);
    });
  });

  describe('MST ratsnest', () => {
    it('should produce minimum spanning tree connections for 4 pads in a line', () => {
      // 4 instances in a line: 0, 10, 20, 30 mm apart
      const instances = [
        makeInstance({ id: 1, pcbX: 0, pcbY: 0, pcbRotation: 0 }),
        makeInstance({ id: 2, pcbX: 10, pcbY: 0, pcbRotation: 0 }),
        makeInstance({ id: 3, pcbX: 20, pcbY: 0, pcbRotation: 0 }),
        makeInstance({ id: 4, pcbX: 30, pcbY: 0, pcbRotation: 0 }),
      ];

      const nets: NetRecord[] = [{
        id: 60,
        name: 'BUS',
        segments: [
          { fromInstanceId: 1, fromPin: '1', toInstanceId: 2, toPin: '1' },
          { fromInstanceId: 2, fromPin: '1', toInstanceId: 3, toPin: '1' },
          { fromInstanceId: 3, fromPin: '1', toInstanceId: 4, toPin: '1' },
        ],
      }];

      const result = NetPadMapper.resolve(nets, instances, getFootprintForTests);

      const netRatsnest = result.ratsnestPairs.filter((r) => r.netId === 60);
      // MST of 4 nodes = 3 edges
      expect(netRatsnest.length).toBe(3);

      // Total MST distance should be sum of 3 shortest edges
      const totalDist = netRatsnest.reduce((sum, pair) => sum + pair.distance, 0);
      // Each adjacent pair is ~10mm apart, MST should connect adjacent ones
      expect(totalDist).toBeLessThan(40);
    });

    it('should use MST to avoid long connections when shorter ones exist', () => {
      // Square: (0,0), (10,0), (10,10), (0,10)
      const instances = [
        makeInstance({ id: 1, pcbX: 0, pcbY: 0, pcbRotation: 0 }),
        makeInstance({ id: 2, pcbX: 10, pcbY: 0, pcbRotation: 0 }),
        makeInstance({ id: 3, pcbX: 10, pcbY: 10, pcbRotation: 0 }),
        makeInstance({ id: 4, pcbX: 0, pcbY: 10, pcbRotation: 0 }),
      ];

      const nets: NetRecord[] = [{
        id: 70,
        name: 'SQUARE',
        segments: [
          { fromInstanceId: 1, fromPin: '1', toInstanceId: 2, toPin: '1' },
          { fromInstanceId: 2, fromPin: '1', toInstanceId: 3, toPin: '1' },
          { fromInstanceId: 3, fromPin: '1', toInstanceId: 4, toPin: '1' },
        ],
      }];

      const result = NetPadMapper.resolve(nets, instances, getFootprintForTests);

      const netRatsnest = result.ratsnestPairs.filter((r) => r.netId === 70);
      // MST of 4 nodes = 3 edges
      expect(netRatsnest.length).toBe(3);

      // MST should NOT include diagonal (~14.14mm), should pick 3 sides (~10mm each)
      for (const pair of netRatsnest) {
        expect(pair.distance).toBeLessThan(12);
      }
    });
  });

  describe('packageType resolution', () => {
    it('should use properties.package to look up footprint', () => {
      const instances = [
        makeInstance({
          id: 1,
          pcbX: 0,
          pcbY: 0,
          pcbRotation: 0,
          properties: { package: 'SOT-23' },
        }),
        makeInstance({
          id: 2,
          pcbX: 10,
          pcbY: 0,
          pcbRotation: 0,
          properties: { package: 'SOT-23' },
        }),
      ];

      const nets: NetRecord[] = [{
        id: 80,
        name: 'BASE',
        segments: [{ fromInstanceId: 1, fromPin: '3', toInstanceId: 2, toPin: '3' }],
      }];

      const result = NetPadMapper.resolve(nets, instances, getFootprintForTests);

      const pads = result.netPads.get(80);
      expect(pads).toBeDefined();
      expect(pads!.length).toBe(2);
      // SOT-23 pad 3 is at (0, -1.0), no rotation -> absolute (0, -1.0) and (10, -1.0)
      const pad1 = pads!.find((p) => p.instanceId === 1);
      expect(pad1!.position.x).toBeCloseTo(0, 4);
      expect(pad1!.position.y).toBeCloseTo(-1.0, 4);
    });

    it('should report unmapped pins when no package property and getFootprint returns null', () => {
      const instances = [
        makeInstance({
          id: 1,
          pcbX: 0,
          pcbY: 0,
          pcbRotation: 0,
          properties: {},
        }),
      ];

      const nets: NetRecord[] = [{
        id: 90,
        name: 'SIG',
        segments: [{ fromInstanceId: 1, fromPin: '1', toInstanceId: 1, toPin: '2' }],
      }];

      // getFootprint returns null for empty string / undefined package
      const result = NetPadMapper.resolve(nets, instances, () => null);

      expect(result.unmappedPins.length).toBeGreaterThan(0);
    });
  });
});
