import { describe, expect, it } from 'vitest';

import { buildGeneratePrompt, collectCircuitAiExactPartIntents } from './prompt';
import type { ComponentPart } from '@shared/schema';

function createPart(
  id: number,
  meta: Record<string, unknown>,
  connectors: Array<{ id: string; name: string }> = [],
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
    connectors: connectors.map((connector) => ({
      connectorType: 'pad',
      shapeIds: {},
      terminalPositions: {},
      ...connector,
    })),
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

describe('circuit AI prompt builder', () => {
  it('annotates verified and candidate exact parts with trust rules', () => {
    const mega = createPart(
      11,
      {
        family: 'microcontroller',
        partFamily: 'board-module',
        title: 'Arduino Mega 2560 R3',
        verificationLevel: 'official-backed',
        verificationStatus: 'verified',
      },
      [{ id: 'D0', name: 'D0' }],
    );
    const riorand = createPart(
      21,
      {
        family: 'motor driver',
        partFamily: 'driver',
        title: 'RioRand Motor Controller',
        verificationLevel: 'mixed-source',
        verificationStatus: 'candidate',
      },
      [{ id: 'VIN+', name: 'VIN+' }],
    );

    const prompt = buildGeneratePrompt('Add an Arduino Mega 2560 R3 and a RioRand motor controller.', [mega, riorand]);

    expect(prompt).toContain('exact-part: verified-exact');
    expect(prompt).toContain('exact-part: provisional-exact');
    expect(prompt).toContain('authoritative wiring: no');
    expect(prompt).toContain('Placement may be provisional');
  });

  it('includes verified board context when exact boards are in the registry', () => {
    const prompt = buildGeneratePrompt('Add an Arduino Mega 2560 R3 and a RioRand motor controller.', []);

    // Both Arduino Mega and RioRand are now in the verified board registry,
    // so the prompt should reference verified matches instead of missing parts.
    expect(prompt).toContain('verified exact part');
  });

  it('collects exact-part intents from the user description', () => {
    const mega = createPart(11, {
      family: 'microcontroller',
      partFamily: 'board-module',
      title: 'Arduino Mega 2560 R3',
      verificationLevel: 'official-backed',
      verificationStatus: 'verified',
    });

    const intents = collectCircuitAiExactPartIntents(
      'Add an Arduino Mega 2560 R3 and a RioRand motor controller.',
      [mega],
    );

    expect(intents).toHaveLength(2);
    expect(intents.find((intent) => intent.title === 'Arduino Mega 2560 R3')?.kind).toBe('verified-match');
    // RioRand is now a verified board in the registry, so it resolves as verified
    expect(intents.find((intent) => intent.title === 'RioRand Motor Controller')?.kind).toBe('verified-match');
  });
});
