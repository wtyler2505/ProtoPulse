import { describe, expect, it } from 'vitest';

import { buildExactPartAiPolicy, summarizeGeneratedCircuitTrust } from '../exact-part-ai-policy';
import type { ComponentPart } from '../schema';

function createPart(
  id: number,
  meta: Record<string, unknown>,
): ComponentPart {
  const now = new Date();
  return {
    id,
    projectId: 1,
    nodeId: null,
    meta: {
      mountingType: 'tht',
      properties: [],
      tags: [],
      title: `Part ${String(id)}`,
      ...meta,
    },
    connectors: [],
    buses: [],
    views: {
      breadboard: { shapes: [] },
      schematic: { shapes: [] },
      pcb: { shapes: [] },
    },
    constraints: [],
    version: 1,
    createdAt: now,
    updatedAt: now,
  };
}

describe('exact-part AI policy helpers', () => {
  it('marks verified exact boards as authoritative for AI placement and wiring', () => {
    const mega = createPart(11, {
      family: 'microcontroller',
      partFamily: 'board-module',
      title: 'Arduino Mega 2560 R3',
      verificationLevel: 'official-backed',
      verificationStatus: 'verified',
    });

    const policy = buildExactPartAiPolicy(mega);

    expect(policy.placementMode).toBe('verified-exact');
    expect(policy.authoritativeWiringAllowed).toBe(true);
    expect(policy.aiRule).toContain('verified');
  });

  it('forces candidate exact driver boards into provisional placement mode', () => {
    const riorand = createPart(21, {
      family: 'motor driver',
      partFamily: 'driver',
      title: 'RioRand Motor Controller',
      verificationLevel: 'mixed-source',
      verificationStatus: 'candidate',
    });

    const policy = buildExactPartAiPolicy(riorand);

    expect(policy.placementMode).toBe('provisional-exact');
    expect(policy.authoritativeWiringAllowed).toBe(false);
    expect(policy.aiRule).toContain('candidate');
  });

  it('summarizes provisional generated circuits when candidate exact parts are used', () => {
    const mega = createPart(11, {
      family: 'microcontroller',
      partFamily: 'board-module',
      title: 'Arduino Mega 2560 R3',
      verificationLevel: 'official-backed',
      verificationStatus: 'verified',
    });
    const riorand = createPart(21, {
      family: 'motor driver',
      partFamily: 'driver',
      title: 'RioRand Motor Controller',
      verificationLevel: 'mixed-source',
      verificationStatus: 'candidate',
    });

    const summary = summarizeGeneratedCircuitTrust(
      [
        { partId: 11, referenceDesignator: 'U1' },
        { partId: 21, referenceDesignator: 'U2' },
      ],
      [mega, riorand],
    );

    expect(summary.authoritativeWiringAllowed).toBe(false);
    expect(summary.usedParts).toHaveLength(2);
    expect(summary.summary).toContain('provisional');
    expect(summary.warnings[0]).toContain('candidate exact part');
    expect(summary.warnings[0]).toContain('U2');
  });
});
