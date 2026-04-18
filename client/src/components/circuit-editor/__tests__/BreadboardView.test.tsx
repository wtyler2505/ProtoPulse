/**
 * BreadboardView Component Tests
 *
 * Tests for the BreadboardView React component (client/src/components/circuit-editor/BreadboardView.tsx).
 * Covers rendering states, toolbar, canvas tools, and keyboard shortcuts.
 *
 * Runs in client project config (happy-dom environment).
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import type { ReactNode } from 'react';
import type { CircuitInstanceRow } from '@shared/schema';

import { COMPONENT_DRAG_TYPE } from '../ComponentPlacer';
import { coordToPixel } from '@/lib/circuit-editor/breadboard-model';

// ---------------------------------------------------------------------------
// Mock all hooks and child components before importing BreadboardView
// ---------------------------------------------------------------------------

const mockCircuits = [
  { id: 1, name: 'Main Circuit', projectId: 1, createdAt: new Date(), updatedAt: new Date() },
  { id: 2, name: 'Power Supply', projectId: 1, createdAt: new Date(), updatedAt: new Date() },
];

const mockInstances: CircuitInstanceRow[] = [
  {
    id: 1,
    circuitId: 1,
    partId: 17,
    subDesignId: null,
    referenceDesignator: 'U1',
    schematicX: 100,
    schematicY: 100,
    schematicRotation: 0,
    breadboardX: null,
    breadboardY: null,
    breadboardRotation: 0,
    pcbX: null,
    pcbY: null,
    pcbRotation: 0,
    pcbSide: 'front',
    benchX: null,
    benchY: null,
    properties: { type: 'mcu' },
    createdAt: new Date(),
  },
];

const baseMockNets = [
  {
    id: 1,
    name: 'GND',
    netType: 'ground',
    circuitDesignId: 1,
    segments: [{ fromInstanceId: 1, fromPin: '1', toInstanceId: 2, toPin: '1' }],
  },
];
const mockNets = [...baseMockNets];

const baseMockWires = [
  {
    id: 1,
    circuitDesignId: 1,
    netId: 1,
    view: 'breadboard',
    points: [{ x: 30, y: 50 }, { x: 60, y: 50 }],
    layer: null,
    width: 1.5,
    color: '#e74c3c',
    wireType: 'wire',
  },
  {
    id: 2,
    circuitDesignId: 1,
    netId: 1,
    view: 'schematic', // Should be filtered out
    points: [{ x: 0, y: 0 }, { x: 100, y: 100 }],
    layer: null,
    width: 1,
    color: '#333',
    wireType: 'wire',
  },
];
const mockWires = baseMockWires.map((wire) => ({
  ...wire,
  points: wire.points.map((point) => ({ ...point })),
}));

const baseMockParts = [
  {
    id: 17,
    projectId: 1,
    nodeId: null,
    meta: {
      title: 'ATmega328P DIP',
      family: 'mcu',
      manufacturer: 'Microchip',
      mountingType: 'tht',
      packageType: 'DIP-28',
      properties: [],
      tags: ['microcontroller'],
      type: 'mcu',
      mpn: '',
    },
    connectors: Array.from({ length: 28 }, (_, index) => {
      const names = ['PB0', 'GND', 'VCC', 'RESET'];
      const descriptions = ['GPIO 0', 'Ground return', 'Main supply', 'Reset control'];
      return {
        id: `pin-${index + 1}`,
        name: names[index] ?? `PB${index}`,
        description: descriptions[index] ?? `GPIO ${index}`,
        connectorType: 'pad',
        shapeIds: {},
        terminalPositions: {
          breadboard: {
            x: index < 14 ? 0 : 30,
            y: (index % 14) * 10,
          },
        },
      };
    }),
    buses: [],
    views: {
      breadboard: { shapes: [{ type: 'rect' }] },
      schematic: { shapes: [] },
      pcb: { shapes: [] },
    },
    constraints: null,
    version: 1,
    createdAt: new Date(),
    updatedAt: new Date(),
  },
];
const mockParts = baseMockParts.map((part) => ({
  ...part,
  meta: { ...part.meta },
  connectors: part.connectors.map((connector) => ({
    ...connector,
    terminalPositions: {
      ...connector.terminalPositions,
      breadboard: { ...connector.terminalPositions.breadboard },
    },
  })),
  views: {
    breadboard: { shapes: [...part.views.breadboard.shapes] },
    schematic: { shapes: [...part.views.schematic.shapes] },
    pcb: { shapes: [...part.views.pcb.shapes] },
  },
}));

const mockCreateNet = { mutateAsync: vi.fn() };
const mockCreateWire = { mutate: vi.fn() };
const mockCreateInstance = { mutate: vi.fn() };
const mockDeleteWire = { mutate: vi.fn() };
const mockUpdateInstance = { mutate: vi.fn() };
const mockUpdateWire = { mutate: vi.fn() };
const mockAddBomItem = vi.fn();
const mockUpdateBomItem = vi.fn();
const baseMockBom = [
  {
    id: 'bom-1',
    partNumber: 'ATmega328P-PU',
    manufacturer: 'Microchip',
    description: 'ATmega328P DIP microcontroller',
    quantity: 1,
    unitPrice: 2.4,
    totalPrice: 2.4,
    supplier: 'Digi-Key' as const,
    stock: 100,
    status: 'In Stock',
    quantityOnHand: 2,
    minimumStock: 1,
    storageLocation: 'Drawer A1',
  },
];
const mockBom = baseMockBom.map((item) => ({ ...item }));
const mockCreateCircuitDesign = { mutateAsync: vi.fn().mockResolvedValue({ id: 3, name: 'Breadboard Wiring Canvas' }) };
const mockExpandArchitecture = { mutateAsync: vi.fn().mockResolvedValue({ circuit: { id: 4, name: 'Expanded Circuit' }, instanceCount: 3, netCount: 2 }) };
const mockSetActiveView = vi.fn();
const mockToast = vi.fn();
const chatSendListener = vi.fn();
const chatOpenListener = vi.fn();

vi.mock('@/lib/contexts/project-id-context', () => ({
  useProjectId: () => 1,
}));

vi.mock('@/lib/contexts/simulation-context', () => ({
  useSimulation: () => ({
    isLive: false,
    setIsLive: vi.fn(),
    clearStates: vi.fn(),
    componentStates: {},
    updateComponentState: vi.fn(),
  }),
}));

vi.mock('@/lib/component-editor/hooks', () => ({
  useComponentParts: (_projectId: number) => ({ data: mockParts }),
}));

vi.mock('@/lib/circuit-editor/hooks', () => ({
  useCircuitDesigns: (_projectId: number) => ({ data: mockCircuits, isLoading: false }),
  useCircuitInstances: (_circuitId: number) => ({ data: mockInstances }),
  useCircuitNets: (_circuitId: number) => ({ data: mockNets }),
  useCircuitWires: (_circuitId: number) => ({ data: mockWires }),
  useCreateCircuitDesign: () => mockCreateCircuitDesign,
  useCreateCircuitNet: () => mockCreateNet,
  useCreateCircuitWire: () => mockCreateWire,
  useCreateCircuitInstance: () => mockCreateInstance,
  useDeleteCircuitWire: () => mockDeleteWire,
  useExpandArchitecture: () => mockExpandArchitecture,
  useUpdateCircuitInstance: () => mockUpdateInstance,
  useUpdateCircuitWire: () => mockUpdateWire,
}));

vi.mock('@/lib/project-context', () => ({
  useProjectMeta: () => ({
    projectName: 'Bench Test Project',
    setActiveView: mockSetActiveView,
  }),
  useBom: () => ({
    addBomItem: mockAddBomItem,
    bom: mockBom,
    updateBomItem: mockUpdateBomItem,
  }),
}));

vi.mock('@/hooks/use-toast', () => ({
  useToast: () => ({
    toast: mockToast,
  }),
}));

vi.mock('@/lib/supplier-api', () => ({
  useSupplierApi: () => ({
    quoteBom: vi.fn(() => ({
      items: [
        {
          mpn: 'ATmega328P-PU',
          quantity: 1,
          bestPrice: {
            distributor: 'digikey',
            unitPrice: 2.4,
            totalPrice: 2.4,
            sku: 'ATMEGA328P-PU-ND',
          },
          allOffers: [],
          inStock: true,
          warnings: [],
        },
      ],
      totalCost: 2.4,
      currency: 'USD',
      itemsFound: 1,
      itemsMissing: 0,
      timestamp: 0,
    })),
    searchPart: vi.fn(() => []),
    distributors: [],
    currency: 'USD',
  }),
}));

vi.mock('../BreadboardGrid', () => ({
  default: (props: Record<string, unknown>) => (
    <g data-testid="mock-breadboard-grid" data-props={JSON.stringify(Object.keys(props))} />
  ),
}));

vi.mock('../RatsnestOverlay', () => ({
  default: (props: Record<string, unknown>) => (
    <g data-testid="mock-ratsnest-overlay" data-nets={String(props.nets)} />
  ),
}));

vi.mock('../ToolButton', () => ({
  default: ({ icon: _icon, label, active, onClick, testId }: {
    icon: unknown;
    label: string;
    active?: boolean;
    onClick: () => void;
    testId: string;
  }) => (
    <button type="button"
      data-testid={testId}
      data-active={String(active ?? false)}
      title={label}
      onClick={onClick}
    >
      {label}
    </button>
  ),
}));

vi.mock('@/components/ui/styled-tooltip', () => ({
  StyledTooltip: ({ children }: { children: ReactNode }) => <>{children}</>,
}));

vi.mock('@/components/views/component-editor/ExactPartDraftModal', () => ({
  default: ({
    initialSeed,
    open,
  }: {
    initialSeed?: { description?: string; marketplaceSourceUrl?: string };
    open: boolean;
  }) => (
    open ? (
      <div data-testid="mock-exact-part-draft-modal">
        {initialSeed?.description ?? ''}
        {initialSeed?.marketplaceSourceUrl ? ` | ${initialSeed.marketplaceSourceUrl}` : ''}
      </div>
    ) : null
  ),
}));

vi.mock('@/components/ui/select', () => ({
  Select: ({ children, onValueChange, value }: { children: ReactNode; onValueChange: (v: string) => void; value: string }) => (
    <div data-testid="mock-select" data-value={value} onClick={() => onValueChange('2')}>
      {children}
    </div>
  ),
  SelectTrigger: ({ children, ...props }: { children: ReactNode; 'data-testid'?: string }) => (
    <button type="button" data-testid={props['data-testid'] ?? 'select-trigger'}>{children}</button>
  ),
  SelectValue: ({ placeholder }: { placeholder: string }) => <span>{placeholder}</span>,
  SelectContent: ({ children }: { children: ReactNode }) => <div>{children}</div>,
  SelectItem: ({ children, value }: { children: ReactNode; value: string }) => (
    <div data-value={value}>{children}</div>
  ),
}));

vi.mock('lucide-react', () => ({
  Bot: () => <svg data-testid="icon-bot" />,
  Loader2: () => <svg data-testid="icon-loader" />,
  AlertTriangle: () => <svg data-testid="icon-alert-triangle" />,
  CheckCircle2: () => <svg data-testid="icon-check-circle-2" />,
  RefreshCw: () => <svg data-testid="icon-refresh-cw" />,
  CircuitBoard: () => <svg data-testid="icon-circuit-board" />,
  MousePointer2: () => <svg data-testid="icon-mouse-pointer" />,
  Pencil: () => <svg data-testid="icon-pencil" />,
  Trash2: () => <svg data-testid="icon-trash" />,
  ZoomIn: () => <svg data-testid="icon-zoom-in" />,
  ZoomOut: () => <svg data-testid="icon-zoom-out" />,
  RotateCcw: () => <svg data-testid="icon-rotate-ccw" />,
  Info: () => <svg data-testid="icon-info" />,
  Activity: () => <svg data-testid="icon-activity" />,
  Square: () => <svg data-testid="icon-square" />,
  ShieldAlert: () => <svg data-testid="icon-shield-alert" />,
  XCircle: () => <svg data-testid="icon-x-circle" />,
  PanelLeftClose: () => <svg data-testid="icon-panel-left-close" />,
  PanelLeftOpen: () => <svg data-testid="icon-panel-left-open" />,
  Sparkles: () => <svg data-testid="icon-sparkles" />,
  Cpu: () => <svg data-testid="icon-cpu" />,
  HeartPulse: () => <svg data-testid="icon-heart-pulse" />,
  X: () => <svg data-testid="icon-x" />,
  Lightbulb: () => <svg data-testid="icon-lightbulb" />,
  Radio: () => <svg data-testid="icon-radio" />,
  Shield: () => <svg data-testid="icon-shield" />,
  ToggleLeft: () => <svg data-testid="icon-toggle-left" />,
  Waves: () => <svg data-testid="icon-waves" />,
  Zap: () => <svg data-testid="icon-zap" />,
  ArrowRight: () => <svg data-testid="icon-arrow-right" />,
  Globe2: () => <svg data-testid="icon-globe-2" />,
  PenTool: () => <svg data-testid="icon-pen-tool" />,
  Wand2: () => <svg data-testid="icon-wand-2" />,
  Boxes: () => <svg data-testid="icon-boxes" />,
  MapPin: () => <svg data-testid="icon-map-pin" />,
  PackageCheck: () => <svg data-testid="icon-package-check" />,
  PackagePlus: () => <svg data-testid="icon-package-plus" />,
  Search: () => <svg data-testid="icon-search" />,
  ShoppingCart: () => <svg data-testid="icon-shopping-cart" />,
  GripVertical: () => <svg data-testid="icon-grip-vertical" />,
  ChevronRight: () => <svg data-testid="icon-chevron-right" />,
  ChevronDown: () => <svg data-testid="icon-chevron-down" />,
  BadgeCheck: () => <svg data-testid="icon-badge-check" />,
  DraftingCompass: () => <svg data-testid="icon-drafting-compass" />,
  Layers3: () => <svg data-testid="icon-layers-3" />,
  HelpCircle: () => <svg data-testid="icon-help-circle" />,
  Rocket: () => <svg data-testid="icon-rocket" />,
  Camera: () => <svg data-testid="icon-camera" />,
  Plus: () => <svg data-testid="icon-plus" />,
  Download: () => <svg data-testid="icon-download" />,
}));

vi.mock('../BreadboardComponentRenderer', () => ({
  detectFamily: (type: string | undefined | null) => {
    if (!type) return null;
    const lower = type.toLowerCase();
    if (lower === 'resistor' || lower === 'res' || lower === 'r') return 'resistor';
    if (lower === 'capacitor' || lower === 'cap' || lower === 'c') return 'capacitor';
    if (lower === 'inductor' || lower === 'ind' || lower === 'l') return 'inductor';
    if (lower === 'led') return 'led';
    return null;
  },
  detectExtendedType: (type: string | undefined | null) => {
    if (!type) return null;
    const lower = type.toLowerCase();
    if (lower === 'resistor' || lower === 'res' || lower === 'r') return 'resistor';
    if (lower === 'capacitor' || lower === 'cap' || lower === 'c') return 'capacitor';
    if (lower === 'inductor' || lower === 'ind' || lower === 'l') return 'inductor';
    if (lower === 'led') return 'led';
    if (lower === 'ic' || lower === 'mcu' || lower === 'microcontroller') return 'ic';
    if (lower === 'diode' || lower === 'd') return 'diode';
    if (lower === 'transistor' || lower === 'bjt' || lower === 'mosfet' || lower === 'q') return 'transistor';
    return null;
  },
  getFamilyValues: (family: string | null) => {
    if (family === 'resistor') {
      return [{ value: 1000, label: '1kΩ' }];
    }
    if (family === 'led') {
      return [{ value: 'red', label: 'Red', hex: '#ef4444' }];
    }
    return [];
  },
  getCurrentValueLabel: () => '1kΩ',
  BreadboardComponentOverlay: ({
    instances,
    onInstanceClick,
  }: {
    instances: Array<{ id: number }>;
    onInstanceClick: (id: number) => void;
  }) => (
    <g data-testid="mock-component-overlay">
      {instances.map((instance) => (
        <rect
          key={instance.id}
          data-testid={`mock-instance-${instance.id}`}
          onClick={() => onInstanceClick(instance.id)}
        />
      ))}
    </g>
  ),
}));

vi.mock('@/lib/utils', () => ({
  cn: (...args: unknown[]) => args.filter(Boolean).join(' '),
}));

// Now import BreadboardView after all mocks
import BreadboardView from '../BreadboardView';

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('BreadboardView', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockParts.splice(
      0,
      mockParts.length,
      ...baseMockParts.map((part) => ({
        ...part,
        meta: { ...part.meta },
        connectors: part.connectors.map((connector) => ({
          ...connector,
          terminalPositions: {
            ...connector.terminalPositions,
            breadboard: { ...connector.terminalPositions.breadboard },
          },
        })),
        views: {
          breadboard: { shapes: [...part.views.breadboard.shapes] },
          schematic: { shapes: [...part.views.schematic.shapes] },
          pcb: { shapes: [...part.views.pcb.shapes] },
        },
      })),
    );
    mockInstances.splice(1);
    mockNets.splice(0, mockNets.length, ...baseMockNets.map((net) => ({ ...net })));
    mockWires.splice(
      0,
      mockWires.length,
      ...baseMockWires.map((wire) => ({
        ...wire,
        points: wire.points.map((point) => ({ ...point })),
      })),
    );
    mockBom.splice(0, mockBom.length, ...baseMockBom.map((item) => ({ ...item })));
    mockInstances[0].breadboardX = null;
    mockInstances[0].breadboardY = null;
    mockInstances[0].benchX = null;
    mockInstances[0].benchY = null;
    mockInstances[0].partId = 17;
    mockInstances[0].properties = { type: 'mcu' };
    mockCreateNet.mutateAsync.mockResolvedValue({ id: 99, name: 'VCC', circuitDesignId: 1, netType: 'power' });
    mockCreateCircuitDesign.mutateAsync.mockResolvedValue({ id: 3, name: 'Breadboard Wiring Canvas' });
    mockExpandArchitecture.mutateAsync.mockResolvedValue({ circuit: { id: 4, name: 'Expanded Circuit' }, instanceCount: 3, netCount: 2 });
    window.removeEventListener('protopulse:chat-send', chatSendListener as EventListener);
    window.removeEventListener('protopulse:open-chat-panel', chatOpenListener as EventListener);
    window.addEventListener('protopulse:chat-send', chatSendListener as EventListener);
    window.addEventListener('protopulse:open-chat-panel', chatOpenListener as EventListener);
  });

  describe('rendering', () => {
    it('renders the breadboard view container', () => {
      render(<BreadboardView />);
      expect(screen.getByTestId('breadboard-view')).toBeDefined();
    });

    it('renders the toolbar', () => {
      render(<BreadboardView />);
      expect(screen.getByTestId('breadboard-toolbar')).toBeDefined();
    });

    it('renders the new workbench sidebar with starter shelf and project parts', () => {
      render(<BreadboardView />);
      expect(screen.getByTestId('breadboard-workbench')).toBeDefined();
      expect(screen.getByTestId('breadboard-starter-shelf')).toBeDefined();
      expect(screen.getByTestId('breadboard-board-audit-panel')).toBeDefined();
      expect(screen.getByTestId('button-run-audit')).toBeDefined();
      expect(screen.getByTestId('button-run-audit-inline')).toBeDefined();
      expect(screen.getByTestId('component-placer')).toBeDefined();
      expect(screen.getByTestId('component-placer-filter-owned')).toBeDefined();
      expect(screen.getByTestId('button-breadboard-ai-stash-planner')).toBeDefined();
      expect(screen.getByTestId('button-open-breadboard-stash')).toBeDefined();
    });

    it('renders the canvas container', () => {
      render(<BreadboardView />);
      expect(screen.getByTestId('breadboard-canvas-container')).toBeDefined();
    });

    it('renders the SVG element', () => {
      render(<BreadboardView />);
      expect(screen.getByTestId('breadboard-svg')).toBeDefined();
    });

    it('renders the BreadboardGrid child', () => {
      render(<BreadboardView />);
      expect(screen.getByTestId('mock-breadboard-grid')).toBeDefined();
    });

    it('renders the RatsnestOverlay child', () => {
      render(<BreadboardView />);
      expect(screen.getByTestId('mock-ratsnest-overlay')).toBeDefined();
    });
  });

  describe('toolbar tools', () => {
    it('renders select, wire, and delete tool buttons', () => {
      render(<BreadboardView />);
      expect(screen.getByTestId('tool-select')).toBeDefined();
      expect(screen.getByTestId('tool-wire')).toBeDefined();
      expect(screen.getByTestId('tool-delete')).toBeDefined();
    });

    it('renders zoom controls', () => {
      render(<BreadboardView />);
      expect(screen.getByTestId('tool-zoom-in')).toBeDefined();
      expect(screen.getByTestId('tool-zoom-out')).toBeDefined();
      expect(screen.getByTestId('tool-reset-view')).toBeDefined();
    });

    it('select tool is active by default', () => {
      render(<BreadboardView />);
      const selectBtn = screen.getByTestId('tool-select');
      expect(selectBtn.getAttribute('data-active')).toBe('true');
    });

    it('clicking wire tool activates it', () => {
      render(<BreadboardView />);
      fireEvent.click(screen.getByTestId('tool-wire'));
      expect(screen.getByTestId('tool-wire').getAttribute('data-active')).toBe('true');
      expect(screen.getByTestId('tool-select').getAttribute('data-active')).toBe('false');
    });

    it('clicking delete tool activates it', () => {
      render(<BreadboardView />);
      fireEvent.click(screen.getByTestId('tool-delete'));
      expect(screen.getByTestId('tool-delete').getAttribute('data-active')).toBe('true');
    });
  });

  describe('keyboard shortcuts', () => {
    it('pressing 1 activates select tool', () => {
      render(<BreadboardView />);
      // First activate wire so we can verify switch
      fireEvent.click(screen.getByTestId('tool-wire'));
      expect(screen.getByTestId('tool-wire').getAttribute('data-active')).toBe('true');

      const canvas = screen.getByTestId('breadboard-canvas');
      fireEvent.keyDown(canvas, { key: '1' });
      expect(screen.getByTestId('tool-select').getAttribute('data-active')).toBe('true');
    });

    it('pressing 2 activates wire tool', () => {
      render(<BreadboardView />);
      const canvas = screen.getByTestId('breadboard-canvas');
      fireEvent.keyDown(canvas, { key: '2' });
      expect(screen.getByTestId('tool-wire').getAttribute('data-active')).toBe('true');
    });

    it('pressing 3 activates delete tool', () => {
      render(<BreadboardView />);
      const canvas = screen.getByTestId('breadboard-canvas');
      fireEvent.keyDown(canvas, { key: '3' });
      expect(screen.getByTestId('tool-delete').getAttribute('data-active')).toBe('true');
    });
  });

  describe('empty guidance', () => {
    it('shows guidance when no instances are placed on breadboard', () => {
      render(<BreadboardView />);
      // All mock instances have breadboardX = null
      expect(screen.getByTestId('breadboard-empty-guidance')).toBeDefined();
    });
  });

  describe('wires', () => {
    it('renders breadboard wires (filters out schematic wires)', () => {
      render(<BreadboardView />);
      // Wire 1 is breadboard view, wire 2 is schematic view
      expect(screen.getByTestId('wire-1')).toBeDefined();
      expect(screen.queryByTestId('wire-2')).toBeNull();
    });
  });

  describe('bench AI', () => {
    it('dispatches a chat event for breadboard explanation help', () => {
      render(<BreadboardView />);

      fireEvent.click(screen.getByTestId('button-breadboard-ai-explain'));

      expect(chatOpenListener).toHaveBeenCalledTimes(1);
      expect(chatSendListener).toHaveBeenCalledTimes(1);
    });

    it('dispatches a design-agent open event for the stash planner', () => {
      render(<BreadboardView />);

      fireEvent.click(screen.getByTestId('button-breadboard-ai-stash-planner'));

      expect(chatOpenListener).toHaveBeenCalledTimes(1);
      const openEvent = chatOpenListener.mock.calls[0]?.[0] as CustomEvent<{ designAgent?: boolean; prompt?: string }>;
      expect(openEvent.detail.designAgent).toBe(true);
      expect(openEvent.detail.prompt).toContain('Bench Test Project');
    });

    it('dispatches a design-agent open event for stash reconciliation from the inventory dialog', () => {
      render(<BreadboardView />);

      fireEvent.click(screen.getByTestId('button-open-breadboard-stash'));
      fireEvent.click(screen.getByTestId('button-breadboard-ai-reconcile-inventory'));

      expect(chatOpenListener).toHaveBeenCalledTimes(1);
      const openEvent = chatOpenListener.mock.calls[0]?.[0] as CustomEvent<{ designAgent?: boolean; prompt?: string }>;
      expect(openEvent.detail.designAgent).toBe(true);
      expect(openEvent.detail.prompt).toContain('Audit the current owned stash');
    });

    it('resolves a verified exact part request from the board pack and stages it', async () => {
      // The verified board pack automatically injects Arduino Mega 2560 R3
      // as a synthetic verified match — no project part needed.
      render(<BreadboardView />);

      fireEvent.click(screen.getByTestId('button-breadboard-exact-part-request'));
      fireEvent.change(screen.getByTestId('input-breadboard-exact-part-request'), {
        target: { value: 'Arduino Mega 2560 R3' },
      });

      expect(screen.getByTestId('breadboard-exact-part-resolution-message').textContent).toContain('verified exact part');
      // The verified board pack uses synthetic negative IDs — find the place button dynamically
      const placeButtons = screen.getAllByTestId(/^button-breadboard-exact-place-/);
      expect(placeButtons.length).toBeGreaterThanOrEqual(1);
      fireEvent.click(placeButtons[0]);

      await waitFor(() => {
        expect(mockCreateInstance.mutate).toHaveBeenCalledWith(
          expect.objectContaining({
            breadboardX: null,
            breadboardY: null,
            circuitId: 1,
            properties: expect.objectContaining({
              componentTitle: 'Arduino Mega 2560 R3',
            }),
          }),
        );
      });
    });

    it('launches a seeded exact draft when the exact part request has no verified board match', () => {
      render(<BreadboardView />);

      fireEvent.click(screen.getByTestId('button-breadboard-exact-part-request'));
      // Use a query that does NOT match any verified board in the pack
      fireEvent.change(screen.getByTestId('input-breadboard-exact-part-request'), {
        target: { value: 'Raspberry Pi Pico W' },
      });
      fireEvent.click(screen.getByTestId('button-breadboard-exact-create-draft'));

      // Should fall through to the generic draft flow since no verified board matches
      expect(screen.getByTestId('mock-exact-part-draft-modal')).toBeDefined();
    });

    it('opens a selected-part inspector and primes Gemini ER with the selected component context', () => {
      mockInstances[0].breadboardX = 70;
      mockInstances[0].breadboardY = 50;

      render(<BreadboardView />);

      fireEvent.click(screen.getByTestId('mock-instance-1'));

      expect(screen.getByTestId('breadboard-part-inspector')).toBeDefined();
      expect(screen.getByTestId('breadboard-part-inspector-trust').textContent).toContain('Connector-defined');
      expect(screen.getByTestId('breadboard-part-inspector-coach').textContent).toContain('center trench');
      expect(screen.getByTestId('breadboard-part-inspector-layout-quality').textContent).toContain('Layout quality');
      expect(screen.getByTestId('breadboard-layout-quality-metric-rail-readiness').textContent).toContain('Rail readiness');
      expect(screen.getByTestId('breadboard-part-inspector-plan').textContent).toContain('6 pending');
      expect(screen.getByTestId('breadboard-coach-action-bridge-power-rails').textContent).toContain('VCC rail bridge');
      expect(screen.getByTestId('breadboard-coach-action-bridge-ground-rails').textContent).toContain('GND rail bridge');
      expect(screen.getByTestId('breadboard-coach-action-hookup-power-pin-3').textContent).toContain('VCC rail jumper');
      expect(screen.getByTestId('breadboard-coach-action-hookup-ground-pin-2').textContent).toContain('GND rail jumper');
      expect(screen.getByTestId('breadboard-pin-anchor-overlay')).toBeDefined();
      expect(screen.getByTestId('breadboard-pin-anchor-pin-1')).toBeDefined();

      fireEvent.mouseEnter(screen.getByTestId('breadboard-part-pin-pin-1'));
      expect(screen.getByTestId('breadboard-pin-highlight')).toBeDefined();

      fireEvent.click(screen.getByTestId('button-breadboard-ai-layout-around-part'));

      expect(chatOpenListener).toHaveBeenCalledTimes(1);
      const openEvent = chatOpenListener.mock.calls[0]?.[0] as CustomEvent<{ designAgent?: boolean; prompt?: string }>;
      expect(openEvent.detail.designAgent).toBe(true);
      expect(openEvent.detail.prompt).toContain('Selected part: ATmega328P DIP (U1)');
      expect(openEvent.detail.prompt).toContain('Bench plan:');
      expect(openEvent.detail.prompt).toContain('Pending VCC rail bridge');
      expect(openEvent.detail.prompt).toContain('Pending VCC rail jumper');
      expect(openEvent.detail.prompt).toContain('Bench layout quality:');
      expect(openEvent.detail.prompt).toContain('Bench layout risks:');
      expect(openEvent.detail.prompt).toContain('PB0 -> e1');
      expect(openEvent.detail.prompt).toContain('Orientation guidance:');
    });

    it('previews and applies the bench coach support plan around the selected part', async () => {
      mockInstances[0].breadboardX = 70;
      mockInstances[0].breadboardY = 50;

      render(<BreadboardView />);

      fireEvent.click(screen.getByTestId('mock-instance-1'));
      fireEvent.click(screen.getByTestId('button-breadboard-coach-preview-plan'));

      expect(screen.getByTestId('breadboard-coach-plan-overlay')).toBeDefined();
      expect(screen.getByTestId('breadboard-coach-bridge-bridge-power-rails')).toBeDefined();
      expect(screen.getByTestId('breadboard-coach-bridge-bridge-ground-rails')).toBeDefined();
      expect(screen.getByTestId('breadboard-coach-hookup-hookup-power-pin-3')).toBeDefined();
      expect(screen.getByTestId('breadboard-coach-hookup-hookup-ground-pin-2')).toBeDefined();
      expect(screen.getByTestId('breadboard-coach-suggestion-support-decoupler')).toBeDefined();
      expect(screen.getByTestId('breadboard-coach-suggestion-support-control-pull')).toBeDefined();

      mockCreateWire.mutate.mockClear();
      fireEvent.click(screen.getByTestId('button-breadboard-coach-apply-plan'));

      await waitFor(() => {
        expect(mockCreateInstance.mutate).toHaveBeenCalledTimes(2);
      });
      expect(mockCreateInstance.mutate).toHaveBeenNthCalledWith(
        1,
        expect.objectContaining({
          circuitId: 1,
          partId: null,
          properties: expect.objectContaining({
            coachPlanFor: 'U1',
            coachPlanKey: 'support-decoupler',
            type: 'capacitor',
          }),
        }),
      );
      expect(mockCreateInstance.mutate).toHaveBeenNthCalledWith(
        2,
        expect.objectContaining({
          properties: expect.objectContaining({
            coachPlanFor: 'U1',
            coachPlanKey: 'support-control-pull',
            type: 'resistor',
          }),
        }),
      );
      expect(mockCreateNet.mutateAsync).toHaveBeenCalledTimes(1);
      expect(mockCreateNet.mutateAsync).toHaveBeenCalledWith(
        expect.objectContaining({
          circuitId: 1,
          name: 'VCC',
          netType: 'power',
        }),
      );
      expect(mockCreateWire.mutate).toHaveBeenCalledTimes(4);
      expect(mockCreateWire.mutate).toHaveBeenNthCalledWith(
        1,
        expect.objectContaining({
          circuitId: 1,
          netId: 99,
          view: 'breadboard',
          wireType: 'jump',
        }),
      );
      expect(mockCreateWire.mutate).toHaveBeenNthCalledWith(
        2,
        expect.objectContaining({
          circuitId: 1,
          netId: 1,
          view: 'breadboard',
          wireType: 'jump',
        }),
      );
      expect(mockCreateWire.mutate).toHaveBeenNthCalledWith(
        3,
        expect.objectContaining({
          circuitId: 1,
          netId: 99,
          view: 'breadboard',
          wireType: 'jump',
          points: expect.arrayContaining([
            expect.objectContaining({ y: expect.any(Number) }),
          ]),
        }),
      );
      expect(mockCreateWire.mutate).toHaveBeenNthCalledWith(
        4,
        expect.objectContaining({
          circuitId: 1,
          netId: 1,
          view: 'breadboard',
          wireType: 'jump',
          points: expect.arrayContaining([
            expect.objectContaining({ y: expect.any(Number) }),
          ]),
        }),
      );
      expect(mockToast).toHaveBeenCalledWith(
        expect.objectContaining({
          title: 'Bench coach support staged',
        }),
      );
    });

    it('applies a single coach remediation directly from the overlay', async () => {
      mockInstances[0].breadboardX = 70;
      mockInstances[0].breadboardY = 50;

      render(<BreadboardView />);

      fireEvent.click(screen.getByTestId('mock-instance-1'));
      fireEvent.click(screen.getByTestId('button-breadboard-coach-preview-plan'));
      fireEvent.click(screen.getByTestId('coach-apply-support-decoupler'));

      await waitFor(() => {
        expect(mockCreateInstance.mutate).toHaveBeenCalled();
      });

      expect(mockCreateInstance.mutate).toHaveBeenCalledWith(
        expect.objectContaining({
          circuitId: 1,
          partId: null,
          properties: expect.objectContaining({
            coachPlanFor: 'U1',
            coachPlanKey: 'support-decoupler',
            type: 'capacitor',
          }),
        }),
      );
      expect(mockToast).toHaveBeenCalledWith(
        expect.objectContaining({
          title: 'Coach support staged',
        }),
      );
    });

    it('creates jumper wires from real bench connector anchors with endpoint metadata', async () => {
      mockInstances[0].benchX = 180;
      mockInstances[0].benchY = 160;

      render(<BreadboardView />);

      fireEvent.click(screen.getByTestId('tool-wire'));
      fireEvent.click(screen.getByTestId('bench-connector-hit-1-pin-1'));
      fireEvent.click(screen.getByTestId('bench-connector-hit-1-pin-2'));
      fireEvent.doubleClick(screen.getByTestId('breadboard-canvas'));

      await waitFor(() => {
        expect(mockCreateWire.mutate).toHaveBeenCalled();
      });

      expect(mockCreateWire.mutate).toHaveBeenCalledWith(
        expect.objectContaining({
          circuitId: 1,
          netId: 1,
          view: 'breadboard',
          wireType: 'jump',
          provenance: 'jumper',
          endpointMeta: {
            start: {
              type: 'bench-pin',
              instanceId: 1,
              pinId: 'pin-1',
            },
            end: {
              type: 'bench-pin',
              instanceId: 1,
              pinId: 'pin-2',
            },
          },
        }),
      );
    });

    it('opens shopping with enriched pricing for missing parts', async () => {
      mockParts[0].meta.mpn = 'ATmega328P-PU';
      mockInstances[0].breadboardX = 70;
      mockInstances[0].breadboardY = 50;
      mockBom[0].quantityOnHand = 0;
      mockBom[0].stock = 0;
      mockBom[0].status = 'Out of Stock';

      render(<BreadboardView />);

      fireEvent.click(screen.getByTestId('button-shop-missing-parts'));

      expect(screen.getByTestId('breadboard-shopping-list-dialog')).toBeDefined();
      expect(screen.getByTestId('total-cost').textContent).toContain('2.40');
      expect(screen.getByText(/digikey/i)).toBeInTheDocument();
    });

    it('routes quick intake scan to storage tools', () => {
      render(<BreadboardView />);

      fireEvent.click(screen.getByTestId('quick-intake-scan'));

      expect(mockSetActiveView).toHaveBeenCalledWith('storage');
      expect(mockToast).toHaveBeenCalledWith(
        expect.objectContaining({
          title: 'Opened storage tools',
        }),
      );
    });

    it('keeps staged bench-plan review available after the coach work is already on the board', () => {
      mockInstances[0].breadboardX = 70;
      mockInstances[0].breadboardY = 50;

      mockNets.push({
        ...baseMockNets[0],
        id: 99,
        name: 'VCC',
        netType: 'power',
        segments: [],
      });

      mockInstances.push(
        {
          ...mockInstances[0],
          id: 2,
          referenceDesignator: 'C1',
          partId: null,
          breadboardX: 120,
          breadboardY: 50,
          properties: {
            coachPlanFor: 'U1',
            coachPlanKey: 'support-decoupler',
            type: 'capacitor',
            value: '1e-7',
          },
        },
        {
          ...mockInstances[0],
          id: 3,
          referenceDesignator: 'R1',
          partId: null,
          breadboardX: 110,
          breadboardY: 60,
          properties: {
            coachPlanFor: 'U1',
            coachPlanKey: 'support-control-pull',
            type: 'resistor',
            value: '10000',
          },
        },
      );

      mockWires.push(
        {
          id: 10,
          circuitDesignId: 1,
          netId: 99,
          view: 'breadboard',
          points: [
            coordToPixel({ type: 'rail', rail: 'top_pos', index: 2 }),
            { x: 18, y: 70 },
            coordToPixel({ type: 'terminal', col: 'e', row: 3 }),
          ],
          layer: null,
          width: 1.5,
          color: '#fb7185',
          wireType: 'jump',
        },
        {
          id: 11,
          circuitDesignId: 1,
          netId: 1,
          view: 'breadboard',
          points: [
            coordToPixel({ type: 'rail', rail: 'top_neg', index: 1 }),
            { x: 18, y: 58 },
            coordToPixel({ type: 'terminal', col: 'e', row: 2 }),
          ],
          layer: null,
          width: 1.5,
          color: '#38bdf8',
          wireType: 'jump',
        },
        {
          id: 12,
          circuitDesignId: 1,
          netId: 99,
          view: 'breadboard',
          points: [
            coordToPixel({ type: 'rail', rail: 'top_pos', index: 14 }),
            { x: 95, y: 193 },
            coordToPixel({ type: 'rail', rail: 'bottom_pos', index: 14 }),
          ],
          layer: null,
          width: 1.5,
          color: '#fb7185',
          wireType: 'jump',
        },
        {
          id: 13,
          circuitDesignId: 1,
          netId: 1,
          view: 'breadboard',
          points: [
            coordToPixel({ type: 'rail', rail: 'top_neg', index: 14 }),
            { x: 88, y: 193 },
            coordToPixel({ type: 'rail', rail: 'bottom_neg', index: 14 }),
          ],
          layer: null,
          width: 1.5,
          color: '#38bdf8',
          wireType: 'jump',
        },
      );

      render(<BreadboardView />);

      fireEvent.click(screen.getByTestId('mock-instance-1'));

      expect(screen.getByTestId('breadboard-part-inspector-plan').textContent).toContain('All staged');
      expect(screen.getByTestId('breadboard-part-inspector-layout-quality').textContent).toContain('Layout quality');
      expect(screen.getByTestId('button-breadboard-coach-preview-plan').textContent).toContain('Show bench plan');
      expect(screen.getByTestId('button-breadboard-coach-preview-plan').hasAttribute('disabled')).toBe(false);
      expect(screen.getByTestId('button-breadboard-coach-apply-plan').hasAttribute('disabled')).toBe(true);

      fireEvent.click(screen.getByTestId('button-breadboard-coach-preview-plan'));

      expect(screen.getByTestId('breadboard-coach-plan-overlay')).toBeDefined();
      expect(screen.getByTestId('breadboard-coach-bridge-bridge-power-rails')).toBeDefined();
      expect(screen.getByTestId('breadboard-coach-bridge-bridge-ground-rails')).toBeDefined();
      expect(screen.getByTestId('breadboard-coach-hookup-hookup-power-pin-3')).toBeDefined();
      expect(screen.getByTestId('breadboard-coach-hookup-hookup-ground-pin-2')).toBeDefined();
      expect(screen.getByTestId('breadboard-coach-suggestion-support-decoupler')).toBeDefined();
      expect(screen.getByTestId('breadboard-coach-suggestion-support-control-pull')).toBeDefined();
      expect(screen.getByTestId('button-breadboard-coach-preview-plan').textContent).toContain('Hide bench plan');
    });
  });

  describe('board health', () => {
    it('runs the board audit and surfaces issues for a placed MCU', async () => {
      mockInstances[0].breadboardX = 70;
      mockInstances[0].breadboardY = 50;

      render(<BreadboardView />);

      fireEvent.click(screen.getByTestId('button-run-audit-inline'));

      await waitFor(() => {
        expect(screen.getByTestId('audit-score-badge')).toBeDefined();
      });

      expect(screen.getByTestId('audit-issue-list')).toBeDefined();
      expect(screen.getByTestId('audit-issue-toggle-missing-decoupling-1')).toBeDefined();
      expect(mockToast).toHaveBeenCalledWith(
        expect.objectContaining({
          title: expect.stringMatching(/Board health/),
        }),
      );
    });

    it('focuses the affected part from a board-health issue', async () => {
      mockInstances[0].breadboardX = 70;
      mockInstances[0].breadboardY = 50;

      render(<BreadboardView />);

      fireEvent.click(screen.getByTestId('button-run-audit-inline'));

      await waitFor(() => {
        expect(screen.getByTestId('audit-issue-toggle-missing-decoupling-1')).toBeDefined();
      });

      fireEvent.click(screen.getByTestId('audit-issue-toggle-missing-decoupling-1'));
      fireEvent.click(screen.getByTestId('audit-focus-missing-decoupling-1'));

      await waitFor(() => {
        expect(screen.getByTestId('breadboard-part-inspector')).toBeDefined();
      });

      expect(screen.getByTestId('breadboard-part-inspector-plan').textContent).toContain('pending');
      expect(mockToast).toHaveBeenCalledWith(
        expect.objectContaining({
          title: 'Focused board-health issue',
        }),
      );
    });
  });

  describe('bench inventory', () => {
    it('opens the stash manager and tracks a bench part from the dialog', () => {
      render(<BreadboardView />);

      fireEvent.click(screen.getByTestId('button-open-breadboard-stash'));
      expect(screen.getByTestId('breadboard-inventory-dialog')).toBeDefined();

      fireEvent.change(screen.getByTestId('breadboard-inventory-location-17'), {
        target: { value: 'Bench Bin A3' },
      });
      fireEvent.click(screen.getByTestId('button-breadboard-inventory-save-17'));

      expect(mockUpdateBomItem).toHaveBeenCalledWith(
        'bom-1',
        expect.objectContaining({
          quantityOnHand: 2,
          minimumStock: 1,
          storageLocation: 'Bench Bin A3',
        }),
      );
    });
  });
});

// ============================================================================
// Drag-to-place (BL-0478)
// ============================================================================

describe('BreadboardView — drag-to-place', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('canvas accepts dragOver with project-part drag data', () => {
    render(<BreadboardView />);
    const canvas = screen.getByTestId('breadboard-canvas');
    const event = new Event('dragover', { bubbles: true, cancelable: true });
    Object.defineProperty(event, 'dataTransfer', {
      value: {
        types: [COMPONENT_DRAG_TYPE],
        dropEffect: '',
      },
    });
    Object.defineProperty(event, 'clientX', { value: 200 });
    Object.defineProperty(event, 'clientY', { value: 200 });
    const prevented = !canvas.dispatchEvent(event);
    // preventDefault was called → event default was prevented
    expect(prevented).toBe(true);
  });

  it('canvas ignores dragOver without correct data type', () => {
    render(<BreadboardView />);
    const canvas = screen.getByTestId('breadboard-canvas');
    const event = new Event('dragover', { bubbles: true, cancelable: true });
    Object.defineProperty(event, 'dataTransfer', {
      value: {
        types: ['text/plain'],
        dropEffect: '',
      },
    });
    const prevented = !canvas.dispatchEvent(event);
    expect(prevented).toBe(false);
  });

  it('drop creates a new project-linked instance via mutation', () => {
    render(<BreadboardView />);
    const canvas = screen.getByTestId('breadboard-canvas');

    const dropEvent = createPartDropEvent(17, 200, 200);
    fireEvent(canvas, dropEvent);

    expect(mockCreateInstance.mutate).toHaveBeenCalledTimes(1);
    const callArgs = mockCreateInstance.mutate.mock.calls[0][0] as Record<string, unknown>;
    expect(callArgs.circuitId).toBe(1);
    expect(callArgs.partId).toBe(17);
    expect(callArgs.referenceDesignator).toBe('U2');
    expect(typeof callArgs.breadboardX).toBe('number');
    expect(typeof callArgs.breadboardY).toBe('number');
  });

  it('still supports starter shelf drops for generic parts', () => {
    render(<BreadboardView />);
    const canvas = screen.getByTestId('breadboard-canvas');

    const dropEvent = createLegacyDropEvent('led', 'LED', 220, 220);
    fireEvent(canvas, dropEvent);

    expect(mockCreateInstance.mutate).toHaveBeenCalledTimes(1);
    const callArgs = mockCreateInstance.mutate.mock.calls[0][0] as Record<string, unknown>;
    expect(callArgs.partId).toBeNull();
    expect(callArgs.referenceDesignator).toBe('L1');
  });

  it('drop without component data type does NOT create instance', () => {
    render(<BreadboardView />);
    const canvas = screen.getByTestId('breadboard-canvas');

    // Drop with empty node type (no reactflow data)
    const event = new Event('drop', { bubbles: true, cancelable: true });
    const emptyStore: Record<string, string> = {};
    Object.defineProperty(event, 'dataTransfer', {
      value: {
        types: [],
        getData: (key: string) => emptyStore[key] ?? '',
        setData: vi.fn(),
        dropEffect: 'copy',
        effectAllowed: 'all',
      },
    });
    Object.defineProperty(event, 'clientX', { value: 200 });
    Object.defineProperty(event, 'clientY', { value: 200 });
    fireEvent(canvas, event);

    expect(mockCreateInstance.mutate).not.toHaveBeenCalled();
  });
});

/** Helper to create a synthetic legacy starter-shelf drop event. */
function createLegacyDropEvent(nodeType: string, label: string, clientX: number, clientY: number) {
  const event = new Event('drop', { bubbles: true, cancelable: true }) as Event & {
    dataTransfer: DataTransfer;
    clientX: number;
    clientY: number;
  };
  const dataStore: Record<string, string> = {
    'application/reactflow/type': nodeType,
    'application/reactflow/label': label,
  };
  Object.defineProperty(event, 'dataTransfer', {
    value: {
      types: Object.keys(dataStore),
      getData: (key: string) => dataStore[key] ?? '',
      setData: vi.fn(),
      dropEffect: 'copy',
      effectAllowed: 'all',
    },
  });
  Object.defineProperty(event, 'clientX', { value: clientX });
  Object.defineProperty(event, 'clientY', { value: clientY });
  return event;
}

function createPartDropEvent(partId: number, clientX: number, clientY: number) {
  const event = new Event('drop', { bubbles: true, cancelable: true }) as Event & {
    dataTransfer: DataTransfer;
    clientX: number;
    clientY: number;
  };
  const dataStore: Record<string, string> = {
    [COMPONENT_DRAG_TYPE]: JSON.stringify({ partId }),
  };
  Object.defineProperty(event, 'dataTransfer', {
    value: {
      types: Object.keys(dataStore),
      getData: (key: string) => dataStore[key] ?? '',
      setData: vi.fn(),
      dropEffect: 'copy',
      effectAllowed: 'all',
    },
  });
  Object.defineProperty(event, 'clientX', { value: clientX });
  Object.defineProperty(event, 'clientY', { value: clientY });
  return event;
}

// ============================================================================
// Loading and empty states (separate mock overrides)
// ============================================================================

describe('BreadboardView — loading state', () => {
  it('shows loader when circuits are loading', async () => {
    const hooksModule = await import('@/lib/circuit-editor/hooks') as Record<string, unknown>;
    const originalUseCircuitDesigns = hooksModule.useCircuitDesigns;
    hooksModule.useCircuitDesigns = vi.fn().mockReturnValue({ data: undefined, isLoading: true });

    render(<BreadboardView />);
    expect(screen.getByTestId('breadboard-loading')).toBeDefined();

    // Restore
    hooksModule.useCircuitDesigns = originalUseCircuitDesigns;
  });
});

describe('BreadboardView — empty state', () => {
  it('shows empty state when no circuits exist', async () => {
    const hooksModule = await import('@/lib/circuit-editor/hooks') as Record<string, unknown>;
    const originalUseCircuitDesigns = hooksModule.useCircuitDesigns;
    hooksModule.useCircuitDesigns = vi.fn().mockReturnValue({ data: [], isLoading: false });

    render(<BreadboardView />);
    expect(screen.getByTestId('breadboard-empty')).toBeDefined();

    // Restore
    hooksModule.useCircuitDesigns = originalUseCircuitDesigns;
  });

  it('can create the first breadboard circuit directly from the empty state', async () => {
    const hooksModule = await import('@/lib/circuit-editor/hooks') as Record<string, unknown>;
    const originalUseCircuitDesigns = hooksModule.useCircuitDesigns;
    hooksModule.useCircuitDesigns = vi.fn().mockReturnValue({ data: [], isLoading: false });

    render(<BreadboardView />);
    fireEvent.click(screen.getByTestId('button-create-first-breadboard-circuit'));

    expect(mockCreateCircuitDesign.mutateAsync).toHaveBeenCalledWith({
      projectId: 1,
      name: 'Breadboard Wiring Canvas',
    });

    hooksModule.useCircuitDesigns = originalUseCircuitDesigns;
  });
});
