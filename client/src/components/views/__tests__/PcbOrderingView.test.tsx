import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import React from 'react';

const mockUpdateBoard = vi.fn();
let mockBom: Array<{
  id: string;
  partNumber: string;
  manufacturer: string;
  description: string;
  quantity: number;
  unitPrice: number;
  totalPrice: number;
  supplier: string;
  stock: number;
  status: string;
}> = [];
let mockComponentParts: Array<Record<string, unknown>> = [];
let mockCircuitDesigns: Array<Record<string, unknown>> = [];
let mockCircuitInstances: Array<Record<string, unknown>> = [];
const mockCreateOrder = vi.fn(() => ({ id: 'order-1' }));
const mockSubmitOrder = vi.fn();

const mockBoard = {
  id: 1,
  projectId: 1,
  widthMm: 100,
  heightMm: 80,
  thicknessMm: 1.6,
  cornerRadiusMm: 2,
  layers: 2,
  copperWeightOz: 1,
  finish: 'HASL',
  solderMaskColor: 'green',
  silkscreenColor: 'white',
  minTraceWidthMm: 0.2,
  minDrillSizeMm: 0.3,
  castellatedHoles: false,
  impedanceControl: false,
  viaInPad: false,
  goldFingers: false,
  createdAt: new Date(0),
  updatedAt: new Date(0),
};

vi.mock('@/lib/contexts/project-id-context', () => ({
  useProjectId: () => 1,
}));

vi.mock('@/lib/contexts/project-meta-context', () => ({
  useProjectMeta: () => ({
    projectName: 'Fab Safety Project',
  }),
}));

vi.mock('@/hooks/useProjectBoard', () => ({
  useProjectBoard: () => ({
    board: mockBoard,
    updateBoard: mockUpdateBoard,
  }),
}));

vi.mock('@/lib/contexts/architecture-context', () => ({
  useArchitecture: () => ({
    nodes: [{ id: 'mcu', type: 'component', label: 'MCU' }],
    edges: [],
  }),
}));

vi.mock('@/lib/contexts/bom-context', () => ({
  useBom: () => ({
    bom: mockBom,
  }),
}));

vi.mock('@/lib/contexts/validation-context', () => ({
  useValidation: () => ({
    issues: [],
  }),
}));

vi.mock('@/lib/component-editor/hooks', () => ({
  useComponentParts: () => ({ data: mockComponentParts }),
}));

vi.mock('@/lib/circuit-editor/hooks', () => ({
  useCircuitDesigns: () => ({ data: mockCircuitDesigns }),
  useCircuitInstances: () => ({ data: mockCircuitInstances }),
}));

vi.mock('@/components/ui/button', () => ({
  Button: ({
    children,
    variant: _variant,
    size: _size,
    asChild: _asChild,
    ...props
  }: React.ButtonHTMLAttributes<HTMLButtonElement> & { variant?: string; size?: string; asChild?: boolean }) => (
    <button type="button" {...props}>{children}</button>
  ),
}));

vi.mock('@/components/ui/badge', () => ({
  Badge: ({
    children,
    variant: _variant,
    ...props
  }: React.HTMLAttributes<HTMLSpanElement> & { variant?: string }) => <span {...props}>{children}</span>,
}));

vi.mock('@/components/ui/card', () => ({
  Card: ({ children, ...props }: React.HTMLAttributes<HTMLDivElement>) => <div {...props}>{children}</div>,
  CardContent: ({ children, ...props }: React.HTMLAttributes<HTMLDivElement>) => <div {...props}>{children}</div>,
  CardHeader: ({ children, ...props }: React.HTMLAttributes<HTMLDivElement>) => <div {...props}>{children}</div>,
  CardTitle: ({ children, ...props }: React.HTMLAttributes<HTMLHeadingElement>) => <h3 {...props}>{children}</h3>,
}));

vi.mock('@/components/ui/number-input', () => ({
  NumberInput: (props: React.InputHTMLAttributes<HTMLInputElement>) => <input {...props} />,
}));

vi.mock('@/components/ui/label', () => ({
  Label: ({ children, ...props }: React.LabelHTMLAttributes<HTMLLabelElement>) => <label {...props}>{children}</label>,
}));

vi.mock('@/components/ui/checkbox', () => ({
  Checkbox: ({
    checked,
    onCheckedChange,
    ...props
  }: Omit<React.InputHTMLAttributes<HTMLInputElement>, 'onChange'> & {
    onCheckedChange?: (checked: boolean) => void;
  }) => (
    <input
      type="checkbox"
      checked={Boolean(checked)}
      onChange={(event) => { onCheckedChange?.(event.currentTarget.checked); }}
      {...props}
    />
  ),
}));

vi.mock('@/components/ui/select', () => ({
  Select: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  SelectTrigger: ({ children, ...props }: React.HTMLAttributes<HTMLDivElement>) => <div {...props}>{children}</div>,
  SelectValue: () => <span />,
  SelectContent: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  SelectItem: ({ children, value: _value, ...props }: React.HTMLAttributes<HTMLDivElement> & { value?: string }) => (
    <div {...props}>{children}</div>
  ),
}));

vi.mock('@/components/ui/tabs', () => ({
  Tabs: ({ children, value: _value, onValueChange: _onValueChange, ...props }: React.HTMLAttributes<HTMLDivElement> & {
    value?: string;
    onValueChange?: (value: string) => void;
  }) => <div {...props}>{children}</div>,
  TabsList: ({ children, ...props }: React.HTMLAttributes<HTMLDivElement>) => <div {...props}>{children}</div>,
  TabsTrigger: ({
    children,
    value: _value,
    ...props
  }: React.ButtonHTMLAttributes<HTMLButtonElement> & { value?: string }) => <button type="button" {...props}>{children}</button>,
  TabsContent: ({ children, value: _value, ...props }: React.HTMLAttributes<HTMLDivElement> & { value?: string }) => (
    <div {...props}>{children}</div>
  ),
}));

vi.mock('@/components/ui/scroll-area', () => ({
  ScrollArea: ({ children, ...props }: React.HTMLAttributes<HTMLDivElement>) => <div {...props}>{children}</div>,
}));

vi.mock('@/components/ui/separator', () => ({
  Separator: (props: React.HTMLAttributes<HTMLHRElement>) => <hr {...props} />,
}));

vi.mock('@/components/ui/table', () => ({
  Table: ({ children, ...props }: React.TableHTMLAttributes<HTMLTableElement>) => <table {...props}>{children}</table>,
  TableBody: ({ children, ...props }: React.HTMLAttributes<HTMLTableSectionElement>) => <tbody {...props}>{children}</tbody>,
  TableCell: ({ children, ...props }: React.TdHTMLAttributes<HTMLTableCellElement>) => <td {...props}>{children}</td>,
  TableHead: ({ children, ...props }: React.ThHTMLAttributes<HTMLTableCellElement>) => <th {...props}>{children}</th>,
  TableHeader: ({ children, ...props }: React.HTMLAttributes<HTMLTableSectionElement>) => <thead {...props}>{children}</thead>,
  TableRow: ({ children, ...props }: React.HTMLAttributes<HTMLTableRowElement>) => <tr {...props}>{children}</tr>,
}));

vi.mock('@/components/ui/ReleaseConfidenceCard', () => ({
  default: ({ title }: { title: string }) => <section data-testid="release-confidence">{title}</section>,
}));

vi.mock('@/components/ui/TrustReceiptCard', () => ({
  default: () => <section data-testid="trust-receipt-ordering" />,
}));

vi.mock('@/components/ui/vault-info-icon', () => ({
  VaultInfoIcon: () => null,
}));

vi.mock('@/components/views/procurement/FabApiSettings', () => ({
  FabApiSettings: ({ fabName }: { fabName: string }) => <div data-testid="fab-api-settings">{fabName}</div>,
}));

vi.mock('@/lib/pcb-ordering', () => {
  const fabricator = {
    id: 'jlcpcb',
    name: 'JLCPCB',
    capabilities: {
      maxLayers: 8,
      minTrace: 0.1,
      minDrill: 0.2,
      turnaroundDays: { economy: 7, standard: 5, rush: 3 },
    },
  };
  const quote = {
    fabricator: 'jlcpcb',
    quantity: 5,
    unitPrice: 1.2,
    totalPrice: 6,
    shippingCost: 8,
    grandTotal: 14,
    currency: 'USD',
    turnaround: 'standard',
    turnaroundDays: 5,
    validUntil: Date.now() + 86_400_000,
    breakdown: [],
  };

  return {
    usePcbOrdering: () => ({
      fabricators: [fabricator],
      runDfmCheck: vi.fn(() => ({
        passed: true,
        issues: [],
        checkedAt: Date.now(),
        fabricator: 'jlcpcb',
      })),
      getQuote: vi.fn(() => quote),
      compareQuotes: vi.fn(() => [quote]),
      createOrder: mockCreateOrder,
      submitOrder: mockSubmitOrder,
      orders: [],
      cancelOrder: vi.fn(),
      compareFabricators: vi.fn(() => [{ fabricator, compatible: true, issues: [] }]),
      orderHistory: [],
      exportOrders: vi.fn(() => '[]'),
      importOrders: vi.fn(() => ({ imported: 0, errors: [] })),
    }),
  };
});

import PcbOrderingView from '@/components/views/PcbOrderingView';

function baseBomItem() {
  return {
    id: 'bom-1',
    partNumber: 'ESP32-S3-WROOM-1',
    manufacturer: 'Espressif',
    description: 'MCU module',
    quantity: 1,
    unitPrice: 3.5,
    totalPrice: 3.5,
    supplier: 'Digi-Key',
    stock: 25,
    status: 'In Stock',
  };
}

function baseCircuitInstance(properties: Record<string, unknown>) {
  return {
    id: 10,
    circuitId: 7,
    partId: 101,
    subDesignId: null,
    referenceDesignator: 'U1',
    schematicX: 0,
    schematicY: 0,
    schematicRotation: 0,
    breadboardX: null,
    breadboardY: null,
    breadboardRotation: 0,
    benchX: null,
    benchY: null,
    pcbX: 12,
    pcbY: 18,
    pcbRotation: 0,
    pcbSide: 'front',
    properties,
    createdAt: new Date(0),
  };
}

function baseComponentPart(meta: Record<string, unknown>) {
  return {
    id: 101,
    projectId: 1,
    nodeId: 'mcu',
    meta,
    connectors: [],
    buses: [],
    views: {},
    constraints: [],
    version: 1,
    createdAt: new Date(0),
    updatedAt: new Date(0),
  };
}

function selectFabAndQuote() {
  fireEvent.click(screen.getByTestId('fab-card-jlcpcb'));
  fireEvent.click(screen.getByTestId('run-dfm-btn'));
}

describe('PcbOrderingView fabrication safety gate', { timeout: 15000 }, () => {
  beforeEach(() => {
    vi.clearAllMocks();
    window.localStorage.removeItem('protopulse-pcb-orders');
    window.localStorage.setItem('protopulse-session-id', 'test-session');
    mockBom = [baseBomItem()];
    mockCircuitDesigns = [{ id: 7, projectId: 1, name: 'Main circuit' }];
    mockCircuitInstances = [];
    mockComponentParts = [];
  });

  it('blocks placing an order when generated circuit instances are not exact-part verified', () => {
    mockCircuitInstances = [baseCircuitInstance({ generatedFrom: 'ai-chat' })];
    mockComponentParts = [baseComponentPart({ verificationStatus: 'draft', mechanicalModelQuality: 'candidate' })];

    render(<PcbOrderingView />);

    expect(screen.getByTestId('ordering-safety-status').textContent).toContain('Blocked');
    expect(screen.getByText(/AI-generated circuit instance/)).toBeDefined();

    selectFabAndQuote();

    const placeOrder = screen.getByTestId('place-order-btn') as HTMLButtonElement;
    expect(screen.getByTestId('quote-row-jlcpcb')).toBeDefined();
    expect(placeOrder.disabled).toBe(true);
    expect(screen.getByTestId('place-order-blocked-message').textContent).toContain('blocked');
    fireEvent.click(placeOrder);
    expect(mockCreateOrder).not.toHaveBeenCalled();
  });

  it('allows placing an order when the fab-package trust gate has no blockers', () => {
    mockCircuitInstances = [
      baseCircuitInstance({
        generatedFrom: 'ai-chat',
        exactPartTrust: { status: 'verified' },
      }),
    ];
    mockComponentParts = [
      baseComponentPart({
        verificationStatus: 'verified',
        mechanicalModelQuality: 'verified',
      }),
    ];

    render(<PcbOrderingView />);

    expect(screen.getByTestId('ordering-safety-status').textContent).toContain('Ready');

    selectFabAndQuote();

    const placeOrder = screen.getByTestId('place-order-btn') as HTMLButtonElement;
    expect(screen.getByTestId('quote-row-jlcpcb')).toBeDefined();
    expect(placeOrder.disabled).toBe(false);
    fireEvent.click(placeOrder);
    expect(mockCreateOrder).toHaveBeenCalledWith('jlcpcb', expect.objectContaining({ width: 100, height: 80 }), 5);
    expect(mockSubmitOrder).toHaveBeenCalledWith('order-1');
  });
});
