import { beforeEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import type { ReactNode } from 'react';
import SupplyChainAlertsPanel from '@/components/views/SupplyChainAlertsPanel';

const mockAck = vi.fn();
const mockAckAll = vi.fn();
const mockCheck = vi.fn();

let mockAlerts: Array<Record<string, unknown>> = [];
let mockBom: Array<Record<string, unknown>> = [];
let mockComponentParts: Array<Record<string, unknown>> = [];
let mockCircuitDesigns: Array<Record<string, unknown>> = [];
let mockCircuitInstances: Array<Record<string, unknown>> = [];
let mockShortfalls:
  | { data: Array<Record<string, unknown>>; total: number; totalShortfallUnits: number }
  | undefined;

vi.mock('@/lib/contexts/project-meta-context', () => ({
  useProjectMeta: () => ({ projectName: 'Supply Chain Test Project' }),
}));

vi.mock('@/lib/contexts/architecture-context', () => ({
  useArchitecture: () => ({ nodes: [{ id: 'mcu', data: { label: 'MCU' } }], edges: [] }),
}));

vi.mock('@/lib/contexts/bom-context', () => ({
  useBom: () => ({ bom: mockBom }),
}));

vi.mock('@/lib/component-editor/hooks', () => ({
  useComponentParts: () => ({ data: mockComponentParts }),
}));

vi.mock('@/lib/circuit-editor/hooks', () => ({
  useCircuitDesigns: () => ({ data: mockCircuitDesigns }),
  useCircuitInstances: () => ({ data: mockCircuitInstances }),
}));

vi.mock('@/lib/parts/use-bom-shortfalls', () => ({
  useBomShortfalls: () => ({ data: mockShortfalls }),
}));

vi.mock('@/lib/parts/use-supply-chain', () => ({
  useSupplyChainAlerts: () => ({ data: mockAlerts, isLoading: false }),
  useAcknowledgeAlert: () => ({ mutate: mockAck, isPending: false }),
  useAcknowledgeAllAlerts: () => ({ mutate: mockAckAll, isPending: false }),
  useTriggerSupplyChainCheck: () => ({ mutate: mockCheck, isPending: false }),
}));

vi.mock('@/components/ui/scroll-area', () => ({
  ScrollArea: ({ children, ...props }: { children: ReactNode }) => <div {...props}>{children}</div>,
}));

function makeAlert(overrides: Record<string, unknown> = {}) {
  return {
    id: 'alert-1',
    partId: 'part-1',
    projectId: 1,
    alertType: 'stock_drop',
    severity: 'warning',
    message: 'Stock dropped for MCU-123',
    previousValue: null,
    currentValue: null,
    supplier: 'Digi-Key',
    acknowledged: false,
    acknowledgedAt: null,
    createdAt: '2026-05-24T12:00:00.000Z',
    ...overrides,
  };
}

function makeBomItem(overrides: Record<string, unknown> = {}) {
  return {
    id: 'bom-1',
    partNumber: 'MCU-123',
    manufacturer: 'Acme',
    description: 'Controller',
    quantity: 1,
    unitPrice: 1,
    totalPrice: 1,
    supplier: 'Digi-Key',
    stock: 100,
    status: 'In Stock',
    ...overrides,
  };
}

function makeInstance(overrides: Record<string, unknown> = {}) {
  return {
    id: 1,
    circuitId: 1,
    partId: 42,
    referenceDesignator: 'U1',
    pcbX: 10,
    pcbY: 10,
    properties: { generatedFrom: 'generative-design' },
    ...overrides,
  };
}

describe('SupplyChainAlertsPanel trust gate', () => {
  beforeEach(() => {
    mockAck.mockReset();
    mockAckAll.mockReset();
    mockCheck.mockReset();
    window.localStorage.setItem('protopulse-session-id', 'session-1');
    mockAlerts = [makeAlert()];
    mockBom = [makeBomItem()];
    mockCircuitDesigns = [{ id: 1 }];
    mockCircuitInstances = [makeInstance()];
    mockComponentParts = [{ id: 42, meta: {} }];
    mockShortfalls = { data: [], total: 0, totalShortfallUnits: 0 };
  });

  it('blocks bulk dismiss when source confidence has hard blockers', () => {
    render(<SupplyChainAlertsPanel projectId={1} />);

    expect(screen.getByTestId('supply-chain-trust-status')).toHaveTextContent('Blocked');
    expect(screen.getByTestId('supply-chain-trust-blocker')).toHaveTextContent('AI-Generated Circuit Provenance');
    expect(screen.getByTestId('supply-chain-ack-all')).toBeDisabled();

    fireEvent.click(screen.getByTestId('supply-chain-check'));
    expect(mockCheck).toHaveBeenCalledWith(1);
  });

  it('allows bulk dismiss after exact-part and source confidence signals are ready', () => {
    mockComponentParts = [{
      id: 42,
      meta: {
        verificationStatus: 'verified',
        mechanicalModelQuality: 'verified',
      },
    }];

    render(<SupplyChainAlertsPanel projectId={1} />);

    expect(screen.getByTestId('supply-chain-trust-status')).toHaveTextContent('Ready');
    expect(screen.getByTestId('supply-chain-ack-all')).not.toBeDisabled();

    fireEvent.click(screen.getByTestId('supply-chain-ack-all'));
    expect(mockAckAll).toHaveBeenCalledWith(1);
  });
});
