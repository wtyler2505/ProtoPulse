import { describe, expect, it } from 'vitest';

import { calculateBreadboardLayoutQuality } from '@/lib/breadboard-layout-quality';
import type { BreadboardSelectedPartModel } from '@/lib/breadboard-part-inspector';

function buildModel(
  overrides: Partial<BreadboardSelectedPartModel> = {},
): BreadboardSelectedPartModel {
  return {
    authoritativeWiringAllowed: true,
    coach: {
      cautions: [],
      headline: 'Make power boring first.',
      nextMoves: ['Wire power first.'],
      orientationSummary: 'Keep the package across the trench.',
      railStrategy: 'Use a clean rail pair first.',
      supportParts: ['100 nF decoupling capacitor'],
    },
    criticalPinCount: 2,
    exactPinCount: 2,
    family: 'mcu',
    fit: 'native',
    fitSummary: 'Native fit.',
    heuristicPinCount: 0,
    instanceId: 1,
    inventorySummary: 'Ready now.',
    manufacturer: 'Microchip',
    missingQuantity: 0,
    modelQuality: 'verified',
    mpn: 'ATTINY85-20PU',
    ownedQuantity: 2,
    partFamily: 'ic-package',
    pinCount: 2,
    pinMapConfidence: 'exact',
    pinTrustSummary: 'Connector-defined bench coordinates are available.',
    pins: [
      {
        confidence: 'exact',
        coord: { type: 'terminal', col: 'e', row: 1 },
        coordLabel: 'e1',
        description: 'Main supply',
        id: 'pin-power',
        isCritical: true,
        label: 'VCC',
        pixel: { x: 40, y: 40 },
        role: 'power',
        side: 'left',
        source: 'connector',
      },
      {
        confidence: 'exact',
        coord: { type: 'terminal', col: 'f', row: 1 },
        coordLabel: 'f1',
        description: 'Ground return',
        id: 'pin-ground',
        isCritical: true,
        label: 'GND',
        pixel: { x: 60, y: 40 },
        role: 'ground',
        side: 'right',
        source: 'connector',
      },
    ],
    readyNow: true,
    refDes: 'U1',
    requiredQuantity: 1,
    requiresVerification: false,
    roleCounts: {
      analog: 0,
      clock: 0,
      communication: 0,
      control: 0,
      ground: 1,
      passive: 0,
      power: 1,
      signal: 0,
    },
    starterFriendly: true,
    storageLocation: 'Bench Drawer C3',
    title: 'ATtiny85',
    trustSummary: 'This part does not require exact-part verification before wiring guidance.',
    type: 'mcu',
    verificationLevel: 'community-only',
    verificationStatus: 'verified',
    trustTier: 'verified-exact',
    ...overrides,
  };
}

describe('breadboard-layout-quality', () => {
  it('rewards fully staged, low-clutter bench setups', () => {
    const result = calculateBreadboardLayoutQuality({
      expectedBridgeCount: 2,
      expectedHookupCount: 2,
      expectedSupportCount: 1,
      model: buildModel(),
      nearbyForeignPartCount: 0,
      nearbyWireCount: 1,
      stagedBridgeCount: 2,
      stagedHookupCount: 2,
      stagedSupportCount: 1,
    });

    expect(result.band).toBe('dialed_in');
    expect(result.label).toBe('Dialed in');
    expect(result.score).toBeGreaterThanOrEqual(95);
    expect(result.strengths.join(' ')).toContain('Power and ground have a staged path');
    expect(result.metrics.find((metric) => metric.id === 'support-coverage')?.score).toBe(100);
  });

  it('calls out fragile layouts with weak trust and missing support work', () => {
    const result = calculateBreadboardLayoutQuality({
      expectedBridgeCount: 2,
      expectedHookupCount: 2,
      expectedSupportCount: 2,
      model: buildModel({
        coach: {
          cautions: [],
          headline: 'Needs cleanup.',
          nextMoves: ['Verify pins first.'],
          orientationSummary: 'Check the package orientation.',
          railStrategy: 'Figure out the rails.',
          supportParts: ['100 nF decoupling capacitor', '10 kΩ pull resistor'],
        },
        exactPinCount: 0,
        fit: 'requires_jumpers',
        heuristicPinCount: 2,
        missingQuantity: 1,
        modelQuality: 'ai_drafted',
        pinMapConfidence: 'heuristic',
        pinTrustSummary: 'Heuristic map.',
        pins: [
          {
            confidence: 'heuristic',
            coord: { type: 'terminal', col: 'e', row: 1 },
            coordLabel: 'e1',
            description: 'Main supply',
            id: 'pin-power',
            isCritical: true,
            label: 'VCC',
            pixel: { x: 40, y: 40 },
            role: 'power',
            side: 'left',
            source: 'layout',
          },
          {
            confidence: 'heuristic',
            coord: { type: 'terminal', col: 'f', row: 1 },
            coordLabel: 'f1',
            description: 'Ground return',
            id: 'pin-ground',
            isCritical: true,
            label: 'GND',
            pixel: { x: 60, y: 40 },
            role: 'ground',
            side: 'right',
            source: 'layout',
          },
        ],
        readyNow: false,
      }),
      nearbyForeignPartCount: 2,
      nearbyWireCount: 5,
      stagedBridgeCount: 0,
      stagedHookupCount: 0,
      stagedSupportCount: 0,
    });

    expect(result.band).toBe('fragile');
    expect(result.score).toBeLessThan(48);
    expect(result.risks.join(' ')).toContain('Critical pins still depend on heuristic anchors');
    expect(result.risks.join(' ')).toContain('support parts are not fully staged');
    expect(result.metrics.find((metric) => metric.id === 'probe-space')?.tone).toBe('risk');
  });
});
