import { describe, expect, it } from 'vitest';

import { resolveExactPartRequest } from '../exact-part-resolver';
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

describe('resolveExactPartRequest', () => {
  it('prefers verified exact matches for exact board requests', () => {
    const mega = createPart(11, {
      aliases: ['mega2560', 'arduino mega rev3'],
      family: 'microcontroller',
      manufacturer: 'Arduino',
      mpn: 'A000067',
      partFamily: 'board-module',
      title: 'Arduino Mega 2560 R3',
      verificationLevel: 'official-backed',
      verificationStatus: 'verified',
    });

    const result = resolveExactPartRequest('Arduino Mega 2560 R3', [mega]);

    expect(result.kind).toBe('verified-match');
    expect(result.topMatch?.part.id).toBe(11);
    expect(result.topMatch?.status).toBe('verified');
    expect(result.recommendedDraftDescription).toContain('USB-B connector');
  });

  it('returns candidate matches when only provisional exact parts exist', () => {
    const riorand = createPart(21, {
      aliases: ['riorand dc motor controller'],
      family: 'motor driver',
      manufacturer: 'RioRand',
      partFamily: 'driver',
      title: 'RioRand Motor Controller 7-70V',
      verificationLevel: 'mixed-source',
      verificationStatus: 'candidate',
    });

    const result = resolveExactPartRequest('RioRand motor controller', [riorand]);

    expect(result.kind).toBe('candidate-match');
    expect(result.topMatch?.part.id).toBe(21);
    expect(result.topMatch?.family).toBe('driver');
    expect(result.message).toContain('candidate exact part');
  });

  it('surfaces ambiguity when multiple strong matches are close', () => {
    const unoR3 = createPart(31, {
      aliases: ['arduino uno rev3'],
      manufacturer: 'Arduino',
      partFamily: 'board-module',
      title: 'Arduino Uno R3',
      verificationStatus: 'verified',
    });
    const unoWifi = createPart(32, {
      aliases: ['arduino uno wifi rev2'],
      manufacturer: 'Arduino',
      partFamily: 'board-module',
      title: 'Arduino Uno WiFi Rev2',
      verificationStatus: 'verified',
    });

    const result = resolveExactPartRequest('Arduino Uno', [unoR3, unoWifi]);

    expect(result.kind).toBe('ambiguous-match');
    expect(result.matches).toHaveLength(2);
    expect(result.message).toContain('Multiple exact parts');
  });

  it('returns a draft-first recommendation when no trustworthy match exists', () => {
    const result = resolveExactPartRequest('RioRand motor controller', []);

    expect(result.kind).toBe('needs-draft');
    expect(result.topMatch).toBeNull();
    expect(result.playbook?.id).toBe('riorand-motor-controller');
    expect(result.recommendedDraftDescription).toContain('Hall sensors');
    expect(result.draftSeed.marketplaceSourceUrl).toBe('https://www.amazon.com/RioRand-6-60V-Brushless-Electric-Controller/dp/B087M2378D');
    expect(result.evidenceChecklist[0]).toContain('Seller or marketplace listing');
  });
});
