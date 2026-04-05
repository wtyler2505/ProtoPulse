import { describe, expect, it } from 'vitest';

import type { Connector, PartViews } from '../component-types';
import { buildExactPartVerificationReadiness } from '../exact-part-verification';

function makeViews(withBreadboard = true): PartViews {
  return {
    breadboard: {
      shapes: withBreadboard ? [{ id: 'board-body', type: 'rect', x: 0, y: 0, width: 100, height: 40, rotation: 0 }] : [],
    },
    pcb: { shapes: [] },
    schematic: { shapes: [] },
  };
}

function makeConnector(id: string): Connector {
  return {
    connectorType: 'male',
    id,
    name: id,
    shapeIds: { breadboard: ['board-body'] },
    terminalPositions: { breadboard: { x: 10, y: 10 } },
  };
}

describe('exact-part verification readiness', () => {
  it('marks board modules ready only when evidence and accuracy are exact', () => {
    const readiness = buildExactPartVerificationReadiness(
      {
        family: 'mcu',
        partFamily: 'board-module',
        pinAccuracyReport: {
          breadboardAnchors: 'exact',
          connectorNames: 'exact',
          electricalRoles: 'exact',
          unresolved: [],
        },
        sourceEvidence: [
          {
            label: 'Official board photo',
            reviewStatus: 'accepted',
            supports: ['outline', 'labels', 'pins'],
            type: 'official-image',
          },
        ],
        tags: ['arduino', 'module'],
        visualAccuracyReport: {
          connectors: 'exact',
          mountingHoles: 'exact',
          outline: 'exact',
          silkscreen: 'exact',
        },
      },
      [makeConnector('D0')],
      makeViews(true),
    );

    expect(readiness.requiresVerification).toBe(true);
    expect(readiness.canVerify).toBe(true);
    expect(readiness.blockers).toEqual([]);
    expect(readiness.summary).toContain('Ready to promote');
  });

  it('blocks promotion when exact anchors and reviewed evidence are missing', () => {
    const readiness = buildExactPartVerificationReadiness(
      {
        family: 'driver',
        partFamily: 'driver',
        pinAccuracyReport: {
          breadboardAnchors: 'approximate',
          connectorNames: 'exact',
          electricalRoles: 'unknown',
          unresolved: ['VM pin anchor still ambiguous'],
        },
        sourceEvidence: [
          {
            label: 'Community SVG',
            reviewStatus: 'pending',
            supports: ['outline', 'labels'],
            type: 'community-svg',
          },
        ],
        tags: ['motor', 'driver', 'module'],
        visualAccuracyReport: {
          connectors: 'approximate',
          mountingHoles: 'unknown',
          outline: 'exact',
          silkscreen: 'approximate',
        },
      },
      [makeConnector('VM')],
      makeViews(true),
    );

    expect(readiness.canVerify).toBe(false);
    expect(readiness.blockers.join(' ')).toContain('Review and accept at least one source');
    expect(readiness.blockers.join(' ')).toContain('Breadboard anchors must be exact');
    expect(readiness.blockers.join(' ')).toContain('Electrical roles must be exact');
    expect(readiness.blockers.join(' ')).toContain('unresolved review item');
  });

  it('does not require exact-part verification for ic packages', () => {
    const readiness = buildExactPartVerificationReadiness(
      {
        family: 'mcu',
        packageType: 'DIP-8',
        tags: ['microcontroller'],
      },
      [makeConnector('PB0')],
      makeViews(false),
    );

    expect(readiness.requiresVerification).toBe(false);
    expect(readiness.canVerify).toBe(true);
    expect(readiness.summary).toContain('without exact board/module verification');
  });
});
