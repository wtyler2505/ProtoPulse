import { describe, it, expect } from 'vitest';
import { auditBreadboard } from '/home/wtyler/Projects/ProtoPulse/client/src/lib/breadboard-board-audit';

describe('probe', () => {
  it('probes', () => {
    const instance: any = {
      id: 700, circuitId: 1, partId: 740, subDesignId: null,
      referenceDesignator: 'U700',
      schematicX:0, schematicY:0, schematicRotation:0,
      breadboardX: 50, breadboardY: 50, breadboardRotation:0,
      pcbX: null, pcbY: null, pcbRotation:0, pcbSide:'front',
      benchX: null, benchY: null, properties: {}, createdAt: new Date(),
    };
    const part: any = {
      id: 740, projectId: 1, nodeId: null,
      meta: { family: 'mcu', title: 'ESP32 generic clone chip' },
      connectors: [], buses: [], views:{}, constraints:[], version:1,
      createdAt: new Date(), updatedAt: new Date(),
    };
    const net: any = {
      id: 1, circuitId: 1, name: 'n', netType:'signal', voltage:null, busWidth:null,
      segments: [{ fromInstanceId: 700, fromPin: 'GPIO23', toInstanceId: 999, toPin: 'D0' }],
      labels: [], style: {}, createdAt: new Date(),
    };
    const result = auditBreadboard({ instances: [instance], wires: [], nets: [net], parts: [part] });
    console.log('ISSUES:', JSON.stringify(result.issues.map(i => ({id: i.id, sev: i.severity})), null, 2));
    expect(result.issues.length).toBeGreaterThan(-1);
  });
});
