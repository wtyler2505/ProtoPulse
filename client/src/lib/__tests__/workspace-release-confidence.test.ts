import { describe, expect, it } from 'vitest';

import { buildWorkspaceReleaseConfidence } from '@/lib/workspace-release-confidence';
import type { Edge, Node } from '@xyflow/react';
import type { BomItem, ValidationIssue } from '@/lib/project-context';

describe('buildWorkspaceReleaseConfidence', () => {
  it('maps workspace state into a scorecard result and applies lifecycle intelligence', () => {
    const bomItems: BomItem[] = [
      {
        id: '1',
        partNumber: 'ATmega16-16PU',
        manufacturer: 'Microchip',
        description: 'Legacy MCU',
        quantity: 1,
        unitPrice: 4.5,
        totalPrice: 4.5,
        supplier: 'Digi-Key',
        stock: 0,
        status: 'Out of Stock',
        assemblyCategory: 'through_hole',
        esdSensitive: false,
      },
    ];
    const validationIssues: ValidationIssue[] = [
      {
        id: 'v-1',
        severity: 'error',
        message: 'Critical DRC issue',
      },
    ];
    const nodes: Node[] = [
      {
        id: 'n-1',
        type: 'mcu',
        position: { x: 10, y: 20 },
        data: {
          label: 'Legacy controller',
          description: 'Main controller node',
        },
      },
    ];
    const edges: Edge[] = [];

    const result = buildWorkspaceReleaseConfidence({
      bomItems,
      validationIssues,
      nodes,
      edges,
    });

    expect(result.overallScore).toBeLessThan(70);
    expect(result.readiness).toBe('yellow');
    expect(result.confidence.band).toBe('exploratory');
    expect(result.confidence.blockers.join(' ')).toContain('EOL or obsolete');
    expect(result.confidence.nextActions.join(' ')).toContain('Resolve all DRC errors');
  });
});
