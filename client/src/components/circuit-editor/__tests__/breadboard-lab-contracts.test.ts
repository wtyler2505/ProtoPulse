/**
 * Breadboard Lab Contract Guard Tests
 *
 * These tests protect the core identity and contracts defined in
 * docs/breadboard/contracts.md. They should fail if fundamental rules around
 * provenance, bench-vs-board state, trust ordering, or sync behavior regress.
 *
 * Run with:
 * npm run test -- client/src/components/circuit-editor/__tests__/breadboard-lab-contracts.test.ts
 */

import { describe, expect, it } from 'vitest';
import type { CircuitInstanceRow, CircuitNetRow, CircuitWireRow, ComponentPart } from '@shared/schema';
import type { NetSegment } from '@shared/circuit-types';
import {
  BREADBOARD_INSTANCE_PROVENANCE_VALUES,
  canCoachSuggestionReplaceProvenance,
  compareBreadboardInstanceProvenanceTrust,
  getBreadboardInstancePlacement,
  getBreadboardInstanceProvenance,
  isBreadboardInstanceProvenance,
} from '@/lib/breadboard-instance-provenance';
import { deriveTrustTier } from '@/lib/breadboard-part-inspector';
import {
  syncBreadboardToSchematic,
  syncSchematicToBreadboard,
} from '@/lib/circuit-editor/view-sync';

function makeInstance(overrides: Partial<CircuitInstanceRow> = {}): CircuitInstanceRow {
  return {
    id: 1,
    circuitId: 1,
    partId: null,
    referenceDesignator: 'R1',
    breadboardX: null,
    breadboardY: null,
    schematicX: 50,
    schematicY: 60,
    schematicRotation: 0,
    breadboardRotation: 0,
    pcbX: null,
    pcbY: null,
    pcbRotation: 0,
    pcbSide: 'front',
    subDesignId: null,
    benchX: null,
    benchY: null,
    properties: null,
    createdAt: new Date(),
    ...(overrides as Record<string, unknown>),
  } as unknown as CircuitInstanceRow;
}

function makeNet(overrides: Partial<CircuitNetRow> & { segments?: NetSegment[] }): CircuitNetRow {
  const { segments, ...rest } = overrides;
  return {
    id: 1,
    circuitId: 1,
    name: 'SIG',
    netType: 'signal',
    voltage: null,
    busWidth: null,
    segments: segments ?? [],
    labels: null,
    style: { color: '#00B7DB' },
    createdAt: new Date(),
    ...(rest as Record<string, unknown>),
  } as unknown as CircuitNetRow;
}

function makeWire(overrides: Partial<CircuitWireRow> = {}): CircuitWireRow {
  return {
    id: 1,
    circuitId: 1,
    netId: 1,
    view: 'breadboard',
    points: [
      { x: 120, y: 200 },
      { x: 300, y: 200 },
    ],
    layer: null,
    width: null,
    color: null,
    wireType: 'wire',
    endpointMeta: null,
    provenance: 'manual',
    createdAt: new Date(),
    ...(overrides as Record<string, unknown>),
  } as unknown as CircuitWireRow;
}

function makePart(overrides: Partial<ComponentPart> = {}): ComponentPart {
  return {
    id: 10,
    libraryId: null,
    name: 'Resistor',
    category: 'passive',
    description: null,
    connectors: [
      {
        id: 'pin1',
        name: 'pin1',
        type: 'male',
        terminalPositions: {
          breadboard: { x: 0, y: 0 },
          schematic: { x: 0, y: 0 },
        },
      },
      {
        id: 'pin2',
        name: 'pin2',
        type: 'male',
        terminalPositions: {
          breadboard: { x: 20, y: 0 },
          schematic: { x: 40, y: 0 },
        },
      },
    ],
    svgData: null,
    meta: null,
    createdAt: new Date(),
    ...(overrides as Record<string, unknown>),
  } as unknown as ComponentPart;
}

describe('Breadboard Lab Contracts', () => {
  describe('Provenance & Trust', () => {
    it('accepts only the canonical instance provenance values', () => {
      const values = [...BREADBOARD_INSTANCE_PROVENANCE_VALUES];

      expect(values).toEqual([
        'starter',
        'project',
        'bench-stash',
        'exact',
        'coach',
        'synced-from-schematic',
      ]);

      for (const value of values) {
        expect(isBreadboardInstanceProvenance(value)).toBe(true);
      }
      expect(isBreadboardInstanceProvenance('unknown')).toBe(false);
    });

    it('reads explicit provenance before falling back to legacy inference', () => {
      const explicit = makeInstance({
        partId: 10,
        properties: { breadboardProvenance: 'exact', coachPlanFor: 'U1' },
      });
      const legacyCoach = makeInstance({
        properties: { coachPlanFor: 'U1', coachPlanKey: 'support-decoupler' },
      });
      const legacyProject = makeInstance({
        partId: 10,
        breadboardX: 80,
        breadboardY: 100,
        properties: { label: 'Project part' },
      });
      const legacyStarter = makeInstance({
        breadboardX: 100,
        breadboardY: 120,
        properties: { type: 'led', label: 'LED' },
      });

      expect(getBreadboardInstanceProvenance(explicit)).toBe('exact');
      expect(getBreadboardInstanceProvenance(legacyCoach)).toBe('coach');
      expect(getBreadboardInstanceProvenance(legacyProject)).toBe('project');
      expect(getBreadboardInstanceProvenance(legacyStarter)).toBe('starter');
    });

    it('ranks coach output below verified exact and project-linked provenance', () => {
      expect(compareBreadboardInstanceProvenanceTrust('coach', 'exact')).toBeLessThan(0);
      expect(compareBreadboardInstanceProvenanceTrust('coach', 'project')).toBeLessThan(0);
      expect(canCoachSuggestionReplaceProvenance('exact')).toBe(false);
      expect(canCoachSuggestionReplaceProvenance('project')).toBe(false);
      expect(canCoachSuggestionReplaceProvenance('exact', { userConfirmed: true })).toBe(true);
    });

    it('keeps verified exact part trust above heuristic/coach-like data', () => {
      expect(deriveTrustTier({
        verificationStatus: 'verified',
        pinMapConfidence: 'exact',
        readyNow: true,
        ownedQuantity: 1,
        requiredQuantity: 1,
      })).toBe('verified-exact');

      expect(deriveTrustTier({
        verificationStatus: 'candidate',
        pinMapConfidence: 'heuristic',
        readyNow: true,
        ownedQuantity: 1,
        requiredQuantity: 1,
      })).toBe('heuristic');
    });
  });

  describe('Bench vs Board Model', () => {
    it('distinguishes bench, board, staged, and conflicting instance states', () => {
      expect(getBreadboardInstancePlacement(makeInstance({ benchX: 10, benchY: 20 }))).toBe('bench');
      expect(getBreadboardInstancePlacement(makeInstance({ breadboardX: 40, breadboardY: 60 }))).toBe('board');
      expect(getBreadboardInstancePlacement(makeInstance())).toBe('staged');
      expect(getBreadboardInstancePlacement(makeInstance({
        benchX: 10,
        benchY: 20,
        breadboardX: 40,
        breadboardY: 60,
      }))).toBe('conflicting');
    });

    it('infers bench-stash provenance for legacy bench-only instances', () => {
      const instance = makeInstance({
        partId: 10,
        benchX: 200,
        benchY: 40,
        properties: { label: 'Bench module' },
      });

      expect(getBreadboardInstancePlacement(instance)).toBe('bench');
      expect(getBreadboardInstanceProvenance(instance)).toBe('bench-stash');
    });
  });

  describe('Schematic ↔ Breadboard Sync', () => {
    it('marks schematic-created breadboard wires as synced', () => {
      const part = makePart();
      const partsMap = new Map([[part.id, part]]);
      const instances = [
        makeInstance({ id: 1, partId: part.id, breadboardX: 100, breadboardY: 200 }),
        makeInstance({ id: 2, partId: part.id, breadboardX: 300, breadboardY: 200 }),
      ];
      const nets = [
        makeNet({
          segments: [
            { fromInstanceId: 1, fromPin: 'pin2', toInstanceId: 2, toPin: 'pin1', waypoints: [] },
          ],
        }),
      ];

      const result = syncSchematicToBreadboard(nets, [], instances, partsMap);

      expect(result.wiresToCreate).toHaveLength(1);
      expect(result.wiresToCreate[0]).toEqual(expect.objectContaining({
        view: 'breadboard',
        provenance: 'synced',
      }));
    });

    it('marks breadboard-created schematic wires as synced', () => {
      const part = makePart();
      const partsMap = new Map([[part.id, part]]);
      const instances = [
        makeInstance({
          id: 1,
          partId: part.id,
          breadboardX: 100,
          breadboardY: 200,
          schematicX: 50,
          schematicY: 60,
        }),
        makeInstance({
          id: 2,
          partId: part.id,
          breadboardX: 300,
          breadboardY: 200,
          schematicX: 200,
          schematicY: 60,
        }),
      ];
      const wires = [makeWire()];

      const result = syncBreadboardToSchematic(wires, [], instances, partsMap);

      expect(result.wiresToCreate).toHaveLength(1);
      expect(result.wiresToCreate[0]).toEqual(expect.objectContaining({
        view: 'schematic',
        provenance: 'synced',
      }));
    });

    it('does not silently replace a manually drawn breadboard wire when it already matches schematic intent', () => {
      const part = makePart();
      const partsMap = new Map([[part.id, part]]);
      const instances = [
        makeInstance({ id: 1, partId: part.id, breadboardX: 100, breadboardY: 200 }),
        makeInstance({ id: 2, partId: part.id, breadboardX: 300, breadboardY: 200 }),
      ];
      const manualWire = makeWire({ provenance: 'manual' });
      const nets = [
        makeNet({
          segments: [
            { fromInstanceId: 1, fromPin: 'pin2', toInstanceId: 2, toPin: 'pin1', waypoints: [] },
          ],
        }),
      ];

      const result = syncSchematicToBreadboard(nets, [manualWire], instances, partsMap);

      expect(result.wiresToCreate).toHaveLength(0);
      expect(result.wireIdsToDelete).toHaveLength(0);
      expect(manualWire.provenance).toBe('manual');
    });
  });
});
