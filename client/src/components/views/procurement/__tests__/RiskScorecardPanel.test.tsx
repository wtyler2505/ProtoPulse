import { render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { BomItem, ValidationIssue } from '@/lib/project-context';
import type { Edge, Node } from '@xyflow/react';

let mockBom: BomItem[] = [
  {
    id: '1',
    partNumber: 'ATmega328P-PU',
    manufacturer: 'Microchip',
    description: '8-bit MCU',
    quantity: 1,
    unitPrice: 2.4,
    totalPrice: 2.4,
    supplier: 'Digi-Key',
    stock: 100,
    status: 'In Stock',
    assemblyCategory: 'through_hole',
    esdSensitive: false,
  },
];

let mockIssues: ValidationIssue[] = [
  {
    id: 'v-1',
    severity: 'info',
    message: 'Minor note',
  },
];

let mockNodes: Node[] = [
  {
    id: 'n-1',
    type: 'mcu',
    position: { x: 0, y: 0 },
    data: {
      label: 'ATmega328P',
      description: 'Main controller',
    },
  },
];

let mockEdges: Edge[] = [
  {
    id: 'e-1',
    source: 'n-1',
    target: 'n-1',
  },
];

vi.mock('@/lib/contexts/bom-context', () => ({
  useBom: () => ({
    bom: mockBom,
  }),
}));

vi.mock('@/lib/contexts/validation-context', () => ({
  useValidation: () => ({
    issues: mockIssues,
  }),
}));

vi.mock('@/lib/contexts/architecture-context', () => ({
  useArchitecture: () => ({
    nodes: mockNodes,
    edges: mockEdges,
  }),
}));

import { RiskScorecardPanel } from '@/components/views/procurement/RiskScorecardPanel';

describe('RiskScorecardPanel', () => {
  beforeEach(() => {
    mockBom = [
      {
        id: '1',
        partNumber: 'ATmega328P-PU',
        manufacturer: 'Microchip',
        description: '8-bit MCU',
        quantity: 1,
        unitPrice: 2.4,
        totalPrice: 2.4,
        supplier: 'Digi-Key',
        stock: 100,
        status: 'In Stock',
        assemblyCategory: 'through_hole',
        esdSensitive: false,
      },
    ];
    mockIssues = [
      {
        id: 'v-1',
        severity: 'info',
        message: 'Minor note',
      },
    ];
    mockNodes = [
      {
        id: 'n-1',
        type: 'mcu',
        position: { x: 0, y: 0 },
        data: {
          label: 'ATmega328P',
          description: 'Main controller',
        },
      },
    ];
    mockEdges = [
      {
        id: 'e-1',
        source: 'n-1',
        target: 'n-1',
      },
    ];
  });

  it('renders the release confidence callout', () => {
    render(<RiskScorecardPanel />);

    expect(screen.getByTestId('release-confidence-panel')).toBeInTheDocument();
    expect(screen.getByTestId('release-confidence-band')).toHaveTextContent('Production-ready');
    expect(screen.getByTestId('release-confidence-evidence')).toHaveTextContent('Evidence strong');
    expect(screen.getByTestId('release-confidence-summary').textContent).toContain('order-ready');
  });

  it('shows blockers and next actions for risky designs', () => {
    mockBom = [
      {
        id: '1',
        partNumber: 'ATMEGA16-16PU',
        manufacturer: 'Microchip',
        description: '',
        quantity: 1,
        unitPrice: 0,
        totalPrice: 0,
        supplier: 'Unknown',
        stock: 0,
        status: 'Out of Stock',
        assemblyCategory: null,
        esdSensitive: false,
      },
    ];
    mockIssues = [
      {
        id: 'v-1',
        severity: 'error',
        message: 'Critical DRC issue',
      },
    ];
    mockNodes = [
      {
        id: 'n-1',
        type: 'mcu',
        position: { x: 0, y: 0 },
        data: {
          label: '',
          description: '',
        },
      },
    ];
    mockEdges = [];

    render(<RiskScorecardPanel />);

    expect(screen.getByTestId('release-confidence-band')).toHaveTextContent('Exploratory only');
    expect(screen.getByTestId('release-confidence-blockers').textContent).toContain('No DRC errors');
    expect(screen.getByTestId('release-confidence-actions').textContent).toContain('Resolve all DRC errors');
  });
});
