import { describe, expect, it } from 'vitest';
import { buildLiveArchitectureCompileReport } from '@/lib/v3-architecture-compiler';
import { buildV3ExecutionReadiness } from '@/lib/v3-execution-readiness';
import type { GraphEdge, GraphNode } from '@/lib/graph-types';

const readyNodes: GraphNode[] = [
  {
    id: 'r1',
    type: 'custom',
    position: { x: 0, y: 0 },
    data: { label: 'R1', kind: 'hardware', referenceDesignator: 'R1', verified: true, pins: ['1', '2'] },
  },
  {
    id: 'c1',
    type: 'custom',
    position: { x: 160, y: 0 },
    data: { label: 'C1', kind: 'hardware', referenceDesignator: 'C1', verified: true, pins: ['1', '2'] },
  },
  {
    id: 'fw',
    type: 'custom',
    position: { x: 80, y: 140 },
    data: {
      label: 'Arduino Firmware',
      kind: 'firmware',
      board: 'Arduino Mega 2560 R3',
      ownedPins: ['D2', 'D3'],
      verified: true,
      verifiedFacts: ['pinout'],
      behavior: 'blink LED',
    },
  },
];

const readyEdges: GraphEdge[] = [
  { id: 'net-1', source: 'r1', target: 'c1', data: { netName: 'NET_LED' } },
];

describe('v3 execution readiness', () => {
  it('blocks swarm dispatch until compile and firmware pin ownership are ready', () => {
    const compileReport = buildLiveArchitectureCompileReport([
      {
        id: 'mcu',
        type: 'custom',
        position: { x: 0, y: 0 },
        data: { label: 'Unverified MCU', kind: 'hardware' },
      },
    ], []);

    const readiness = buildV3ExecutionReadiness([], [], compileReport);

    expect(readiness.status).toBe('blocked');
    expect(readiness.blockedReasons).toEqual(expect.arrayContaining([
      'compile report must be ready before swarm dispatch',
      'firmware boundary node is required before firmware generation',
      'pinout must be verified before firmware generation',
      'at least one owned pin is required before firmware generation',
      'v3-firmware-writer missing verified hardware fact: pinout',
    ]));
    expect(readiness.openAIDispatch.status).toBe('blocked');
    expect(readiness.codexTemplates.status).toBe('blocked');
  });

  it('reports ready OpenAI and Codex dispatch previews after compile and pin gates pass', () => {
    const compileReport = buildLiveArchitectureCompileReport(readyNodes, readyEdges);
    const readiness = buildV3ExecutionReadiness(readyNodes, readyEdges, compileReport);

    expect(compileReport.status).toBe('ready');
    expect(readiness.status).toBe('ready');
    expect(readiness.pinGate.status).toBe('ready');
    expect(readiness.swarmPlan.status).toBe('ready');
    expect(readiness.openAIDispatch.status).toBe('ready');
    expect(readiness.codexTemplates.status).toBe('ready');
    expect(readiness.summary).toMatchObject({
      workers: 3,
      openAIDispatches: 3,
      codexCommands: 3,
      ownedPins: 2,
    });
  });
});
