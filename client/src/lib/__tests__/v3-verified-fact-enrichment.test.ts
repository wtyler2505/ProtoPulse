import { describe, expect, it } from 'vitest';
import { buildLiveArchitectureCompileReport } from '@/lib/v3-architecture-compiler';
import { enrichV3NodesFromVerifiedSources } from '@/lib/v3-verified-fact-enrichment';
import type { GraphEdge, GraphNode } from '@/lib/graph-types';

const nodes: GraphNode[] = [
  {
    id: 'mega',
    type: 'custom',
    position: { x: 0, y: 0 },
    data: { label: 'Arduino Mega 2560 R3', kind: 'hardware', referenceDesignator: 'U1' },
  },
  {
    id: 'r1',
    type: 'custom',
    position: { x: 200, y: 0 },
    data: { label: 'Pullup resistor', kind: 'resistor', referenceDesignator: 'R1', verified: true },
  },
];

const edges: GraphEdge[] = [
  { id: 'signal', source: 'mega', target: 'r1', data: { netName: 'NET_D2', sourcePin: 'D2', targetPin: 'pin1' } },
];

describe('v3 verified fact enrichment', () => {
  it('resolves verified board-pack facts from live architecture node labels', () => {
    const enriched = enrichV3NodesFromVerifiedSources(nodes);

    expect(enriched.facts).toHaveLength(1);
    expect(enriched.facts[0]).toMatchObject({
      subject: 'Arduino Mega 2560 R3',
      factType: 'pinout',
      sourceType: 'verified-board-pack',
      sourceRef: 'shared/verified-boards/arduino-mega-2560-r3',
    });
    expect(enriched.nodes[0].data).toEqual(expect.objectContaining({
      verified: true,
      sourceStatus: 'verified',
      verifiedFacts: expect.arrayContaining(['pinout', 'dimensions', 'source-provenance']),
      pins: expect.arrayContaining(['D2', 'D3', 'D5']),
    }));
  });

  it('allows compile only after the unverified board is enriched from verified sources', () => {
    const blocked = buildLiveArchitectureCompileReport(nodes, edges);
    expect(blocked.status).toBe('blocked');
    expect(blocked.missingFacts).toContain('Arduino Mega 2560 R3: verified hardware fact');

    const ready = buildLiveArchitectureCompileReport(nodes, edges, { enrichFromVerifiedSources: true });
    expect(ready.status).toBe('ready');
    expect(ready.missingFacts).toEqual([]);
    expect(ready.acceptedFacts).toContain('Arduino Mega 2560 R3: pinout from shared/verified-boards/arduino-mega-2560-r3');
    expect(ready.emittedTsx).toContain('<trace from="U1.D2" to="R1.pin1" />');
  });
});
