/**
 * Tests for schematic-alternates — BL-0540
 *
 * Verifies the bridge between AlternatePartsEngine and schematic circuit instances:
 * - findAlternatesForInstance resolves part numbers and queries the engine
 * - findAlternatesForAllInstances batch-processes instances
 * - Formatting helpers (price, level labels, colors)
 * - Edge cases (no part, no MPN, empty instances)
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { AlternatePartsEngine } from '@/lib/alternate-parts';
import {
  findAlternatesForInstance,
  findAlternatesForAllInstances,
  formatPrice,
  equivalenceLevelLabel,
  equivalenceLevelColor,
  confidenceColor,
  statusColor,
} from '@/lib/schematic-alternates';
import type { CircuitInstanceRow, ComponentPart } from '@shared/schema';

// ---------------------------------------------------------------------------
// Helpers — create minimal mock rows
// ---------------------------------------------------------------------------

function makeInstance(overrides: Partial<CircuitInstanceRow> = {}): CircuitInstanceRow {
  return {
    id: 1,
    circuitId: 10,
    partId: 100,
    subDesignId: null,
    referenceDesignator: 'U1',
    schematicX: 0,
    schematicY: 0,
    schematicRotation: 0,
    breadboardX: null,
    breadboardY: null,
    breadboardRotation: 0,
    pcbX: null,
    pcbY: null,
    pcbRotation: 0,
    pcbLayer: null,
    properties: {},
    createdAt: new Date(),
    ...overrides,
  } as CircuitInstanceRow;
}

function makePart(overrides: Partial<ComponentPart> & { meta?: Record<string, unknown> } = {}): ComponentPart {
  const { meta, ...rest } = overrides;
  return {
    id: 100,
    projectId: 1,
    name: 'LM7805',
    type: 'ic',
    views: {},
    meta: {
      title: 'LM7805',
      mpn: 'LM7805',
      manufacturer: 'Texas Instruments',
      ...(meta ?? {}),
    },
    connectors: [],
    createdAt: new Date(),
    ...rest,
  } as unknown as ComponentPart;
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('schematic-alternates', () => {
  beforeEach(() => {
    AlternatePartsEngine.resetForTesting();
  });

  // -------------------------------------------------------------------------
  // findAlternatesForInstance
  // -------------------------------------------------------------------------

  describe('findAlternatesForInstance', () => {
    it('returns alternates when part has a known MPN', () => {
      const instance = makeInstance({ id: 1, referenceDesignator: 'U1' });
      const part = makePart({ meta: { title: 'LM7805', mpn: 'LM7805', manufacturer: 'Texas Instruments' } });

      const info = findAlternatesForInstance(instance, part);

      expect(info.instanceId).toBe(1);
      expect(info.referenceDesignator).toBe('U1');
      expect(info.partNumber).toBe('LM7805');
      expect(info.manufacturer).toBe('Texas Instruments');
      expect(info.alternateCount).toBeGreaterThan(0);
      expect(info.result).not.toBeNull();
      expect(info.result!.alternates.length).toBe(info.alternateCount);
    });

    it('returns zero alternates when part has no MPN', () => {
      const instance = makeInstance({ id: 2, referenceDesignator: 'R1' });
      const part = makePart({ meta: { title: 'Resistor', manufacturer: 'Generic' } });

      const info = findAlternatesForInstance(instance, part);

      expect(info.instanceId).toBe(2);
      expect(info.partNumber).toBe('');
      expect(info.alternateCount).toBe(0);
      expect(info.result).toBeNull();
    });

    it('returns zero alternates when part is undefined', () => {
      const instance = makeInstance({ id: 3, partId: null, referenceDesignator: 'X1' });

      const info = findAlternatesForInstance(instance, undefined);

      expect(info.instanceId).toBe(3);
      expect(info.referenceDesignator).toBe('X1');
      expect(info.partNumber).toBe('');
      expect(info.alternateCount).toBe(0);
      expect(info.result).toBeNull();
    });

    it('returns zero alternates for unknown part number', () => {
      const instance = makeInstance({ id: 4, referenceDesignator: 'U4' });
      const part = makePart({ meta: { title: 'Unknown', mpn: 'ZZZZZ-UNKNOWN-9999', manufacturer: 'Nobody' } });

      const info = findAlternatesForInstance(instance, part);

      expect(info.instanceId).toBe(4);
      expect(info.partNumber).toBe('ZZZZZ-UNKNOWN-9999');
      expect(info.alternateCount).toBe(0);
      expect(info.result).not.toBeNull();
      expect(info.result!.warnings.length).toBeGreaterThan(0);
    });

    it('populates manufacturer from part meta', () => {
      const instance = makeInstance();
      const part = makePart({ meta: { title: 'NE555', mpn: 'NE555', manufacturer: 'Texas Instruments' } });

      const info = findAlternatesForInstance(instance, part);

      expect(info.manufacturer).toBe('Texas Instruments');
    });
  });

  // -------------------------------------------------------------------------
  // findAlternatesForAllInstances
  // -------------------------------------------------------------------------

  describe('findAlternatesForAllInstances', () => {
    it('returns a map of alternates for instances with matches', () => {
      const instances = [
        makeInstance({ id: 1, partId: 100, referenceDesignator: 'U1' }),
        makeInstance({ id: 2, partId: 200, referenceDesignator: 'U2' }),
      ];
      const partsMap = new Map<number, ComponentPart>();
      partsMap.set(100, makePart({
        id: 100,
        meta: { title: 'LM7805', mpn: 'LM7805', manufacturer: 'Texas Instruments' },
      }));
      partsMap.set(200, makePart({
        id: 200,
        meta: { title: 'NE555', mpn: 'NE555', manufacturer: 'Texas Instruments' },
      }));

      const result = findAlternatesForAllInstances(instances, partsMap);

      // Both LM7805 and NE555 have alternates in the built-in database
      expect(result.size).toBeGreaterThanOrEqual(2);
      expect(result.get(1)?.partNumber).toBe('LM7805');
      expect(result.get(2)?.partNumber).toBe('NE555');
    });

    it('excludes instances with zero alternates from the map', () => {
      const instances = [
        makeInstance({ id: 1, partId: 100, referenceDesignator: 'U1' }),
        makeInstance({ id: 2, partId: null, referenceDesignator: 'X1' }),
      ];
      const partsMap = new Map<number, ComponentPart>();
      partsMap.set(100, makePart({
        id: 100,
        meta: { title: 'LM7805', mpn: 'LM7805', manufacturer: 'Texas Instruments' },
      }));

      const result = findAlternatesForAllInstances(instances, partsMap);

      // Instance 2 has no partId, so no alternates
      expect(result.has(1)).toBe(true);
      expect(result.has(2)).toBe(false);
    });

    it('returns empty map for empty instances array', () => {
      const result = findAlternatesForAllInstances([], new Map());

      expect(result.size).toBe(0);
    });

    it('returns empty map when no instances have matching parts', () => {
      const instances = [
        makeInstance({ id: 1, partId: 999, referenceDesignator: 'U1' }),
      ];
      const partsMap = new Map<number, ComponentPart>();
      // partId 999 not in partsMap

      const result = findAlternatesForAllInstances(instances, partsMap);

      expect(result.size).toBe(0);
    });
  });

  // -------------------------------------------------------------------------
  // formatPrice
  // -------------------------------------------------------------------------

  describe('formatPrice', () => {
    it('formats a price with 3 decimal places', () => {
      expect(formatPrice(0.45)).toBe('$0.450');
    });

    it('formats zero', () => {
      expect(formatPrice(0)).toBe('$0.000');
    });

    it('formats larger prices', () => {
      expect(formatPrice(12.5)).toBe('$12.500');
    });

    it('returns -- for undefined', () => {
      expect(formatPrice(undefined)).toBe('--');
    });
  });

  // -------------------------------------------------------------------------
  // equivalenceLevelLabel
  // -------------------------------------------------------------------------

  describe('equivalenceLevelLabel', () => {
    it('returns correct label for each level', () => {
      expect(equivalenceLevelLabel('exact')).toBe('Exact');
      expect(equivalenceLevelLabel('functional')).toBe('Functional');
      expect(equivalenceLevelLabel('pin-compatible')).toBe('Pin-compatible');
      expect(equivalenceLevelLabel('similar')).toBe('Similar');
      expect(equivalenceLevelLabel('upgrade')).toBe('Upgrade');
    });
  });

  // -------------------------------------------------------------------------
  // equivalenceLevelColor
  // -------------------------------------------------------------------------

  describe('equivalenceLevelColor', () => {
    it('returns a Tailwind color class for each level', () => {
      expect(equivalenceLevelColor('exact')).toContain('green');
      expect(equivalenceLevelColor('functional')).toContain('blue');
      expect(equivalenceLevelColor('pin-compatible')).toContain('cyan');
      expect(equivalenceLevelColor('similar')).toContain('yellow');
      expect(equivalenceLevelColor('upgrade')).toContain('purple');
    });
  });

  // -------------------------------------------------------------------------
  // confidenceColor
  // -------------------------------------------------------------------------

  describe('confidenceColor', () => {
    it('returns green for high', () => {
      expect(confidenceColor('high')).toContain('green');
    });

    it('returns yellow for medium', () => {
      expect(confidenceColor('medium')).toContain('yellow');
    });

    it('returns red for low', () => {
      expect(confidenceColor('low')).toContain('red');
    });
  });

  // -------------------------------------------------------------------------
  // statusColor
  // -------------------------------------------------------------------------

  describe('statusColor', () => {
    it('returns correct color for each status', () => {
      expect(statusColor('active')).toContain('green');
      expect(statusColor('nrnd')).toContain('yellow');
      expect(statusColor('eol')).toContain('orange');
      expect(statusColor('obsolete')).toContain('red');
      expect(statusColor('unknown')).toContain('muted');
    });
  });

  // -------------------------------------------------------------------------
  // Edge cases & integration
  // -------------------------------------------------------------------------

  describe('integration', () => {
    it('alternate results include score and equivalence level', () => {
      const instance = makeInstance({ id: 1, referenceDesignator: 'U1' });
      const part = makePart({ meta: { title: 'LM7805', mpn: 'LM7805', manufacturer: 'Texas Instruments' } });

      const info = findAlternatesForInstance(instance, part);
      const alts = info.result?.alternates ?? [];

      expect(alts.length).toBeGreaterThan(0);
      for (const alt of alts) {
        expect(alt.score).toBeGreaterThan(0);
        expect(['exact', 'functional', 'pin-compatible', 'similar', 'upgrade']).toContain(alt.equivalenceLevel);
        expect(['high', 'medium', 'low']).toContain(alt.confidence);
      }
    });

    it('alternates are sorted by score descending', () => {
      const instance = makeInstance({ id: 1, referenceDesignator: 'U1' });
      const part = makePart({ meta: { title: 'LM7805', mpn: 'LM7805', manufacturer: 'Texas Instruments' } });

      const info = findAlternatesForInstance(instance, part);
      const alts = info.result?.alternates ?? [];

      for (let i = 1; i < alts.length; i++) {
        expect(alts[i - 1].score).toBeGreaterThanOrEqual(alts[i].score);
      }
    });

    it('NE555 finds LM555 and TLC555 as alternates', () => {
      const instance = makeInstance({ id: 5, referenceDesignator: 'U5' });
      const part = makePart({ meta: { title: 'NE555', mpn: 'NE555', manufacturer: 'Texas Instruments' } });

      const info = findAlternatesForInstance(instance, part);
      const partNumbers = (info.result?.alternates ?? []).map((a) => a.part.partNumber);

      expect(partNumbers).toContain('LM555');
      expect(partNumbers).toContain('TLC555');
    });

    it('LM358 finds LM2904 as alternate', () => {
      const instance = makeInstance({ id: 6, referenceDesignator: 'U6' });
      const part = makePart({ meta: { title: 'LM358', mpn: 'LM358', manufacturer: 'Texas Instruments' } });

      const info = findAlternatesForInstance(instance, part);
      const partNumbers = (info.result?.alternates ?? []).map((a) => a.part.partNumber);

      expect(partNumbers).toContain('LM2904');
    });

    it('result contains originalPart data', () => {
      const instance = makeInstance({ id: 7, referenceDesignator: 'U7' });
      const part = makePart({ meta: { title: 'LM7805', mpn: 'LM7805', manufacturer: 'Texas Instruments' } });

      const info = findAlternatesForInstance(instance, part);

      expect(info.result).not.toBeNull();
      expect(info.result!.originalPart.partNumber).toBe('LM7805');
      expect(info.result!.originalPart.manufacturer).toBe('Texas Instruments');
    });
  });
});
