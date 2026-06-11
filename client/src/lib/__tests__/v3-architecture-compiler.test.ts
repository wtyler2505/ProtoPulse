import { describe, expect, it } from 'vitest';
import type { GraphEdge, GraphNode } from '@/lib/graph-types';
import {
  buildLiveArchitectureCompileReport,
  runLiveArchitectureTSCircuitCompile,
} from '@/lib/v3-architecture-compiler';

const readyNodes: GraphNode[] = [
  {
    id: 'board',
    type: 'custom',
    position: { x: 0, y: 0 },
    data: { label: 'Rover board outline', type: 'mechanical', width: '72mm', height: '45mm' },
  },
  {
    id: 'mega',
    type: 'custom',
    position: { x: 100, y: 100 },
    data: {
      label: 'Arduino Mega 2560',
      type: 'hardware',
      verified: true,
      referenceDesignator: 'U1',
      partNumber: 'A000067',
      footprint: 'dip100w63p254l5300h800q64',
    },
  },
  {
    id: 'conn',
    type: 'custom',
    position: { x: 300, y: 100 },
    data: {
      label: 'Motor connector',
      type: 'connector',
      verified: true,
      referenceDesignator: 'J1',
      footprint: 'pinrow2',
    },
  },
  {
    id: 'rail',
    type: 'custom',
    position: { x: 100, y: 0 },
    data: { label: '5V rail', type: 'power', net: 'net.V5' },
  },
];

const readyEdges: GraphEdge[] = [
  {
    id: 'motor-signal',
    source: 'mega',
    target: 'conn',
    label: 'PWM motor signal',
    data: { netName: 'net.PWM_MOTOR', sourcePin: 'pin5', targetPin: 'pin1', signalType: 'pwm' },
  },
];

const simpleCompileNodes: GraphNode[] = [
  {
    id: 'r1',
    type: 'custom',
    position: { x: 0, y: 0 },
    data: { label: 'Pullup', type: 'resistor', verified: true, referenceDesignator: 'R1', value: '10k', footprint: '0603' },
  },
  {
    id: 'c1',
    type: 'custom',
    position: { x: 200, y: 0 },
    data: { label: 'Filter cap', type: 'capacitor', verified: true, referenceDesignator: 'C1', value: '100nF', footprint: '0603' },
  },
];

const simpleCompileEdges: GraphEdge[] = [
  {
    id: 'rc',
    source: 'r1',
    target: 'c1',
    label: 'RC',
    data: { netName: 'net.RC', sourcePin: 'pin1', targetPin: 'pin1' },
  },
];

describe('v3 architecture compiler', () => {
  it('builds a ready tscircuit compile report from verified live architecture nodes', () => {
    const report = buildLiveArchitectureCompileReport(readyNodes, readyEdges);

    expect(report.status).toBe('ready');
    expect(report.summary).toEqual(expect.objectContaining({
      boardWidth: '72mm',
      boardHeight: '45mm',
      chips: 1,
      connectors: 1,
      powerRails: 1,
      nets: 1,
      traces: 1,
    }));
    expect(report.compileInput?.instances).toHaveLength(2);
    expect(report.compileInput?.nets).toHaveLength(1);
    expect(report.emittedTsx).toContain('<board width="72mm" height="45mm">');
    expect(report.emittedTsx).toContain('<chip name="U1"');
    expect(report.emittedTsx).toContain('<trace from="U1.pin5" to="J1.pin1" />');
  });

  it('blocks tscircuit emit when hardware facts are not verified', () => {
    const report = buildLiveArchitectureCompileReport([
      {
        id: 'unknown',
        type: 'custom',
        position: { x: 0, y: 0 },
        data: { label: 'Mystery module', type: 'hardware', referenceDesignator: 'U9' },
      },
    ], []);

    expect(report.status).toBe('blocked');
    expect(report.compileInput).toBeUndefined();
    expect(report.emittedTsx).toBeUndefined();
    expect(report.missingFacts).toEqual(['Mystery module: verified hardware fact']);
  });

  it('runs the ready live compile report through real @tscircuit/core Circuit JSON', async () => {
    const report = await runLiveArchitectureTSCircuitCompile(simpleCompileNodes, simpleCompileEdges);

    expect(report.status).toBe('ready');
    expect(report.compileProof?.summary.softwareUsed).toContain('@tscircuit/core');
    expect(report.compileProof?.summary.inputMode).toBe('project-instances');
    expect(report.compileProof?.summary.mappedInstanceCount).toBe(2);
    expect(report.compileProof?.summary.mappedTraceCount).toBe(1);
  }, 90_000);
});
