/* eslint-disable jsx-a11y/click-events-have-key-events, jsx-a11y/no-static-element-interactions --
 * Phase 3 <InteractiveCard> primitive migration will replace `role="button"` on
 * `<div>` elements with real `<button>` elements, at which point these disables
 * can be removed. See docs/superpowers/plans/2026-04-18-e2e-walkthrough/03-a11y-systemic.md
 * Phase 3. Tracked as part of E2E-552 / Plan 03 Phase 4.
 */
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
import { PROTOPULSE_DRAG_LABEL, PROTOPULSE_DRAG_TYPE } from '@/lib/drag-mime';
import {
  RADIAL_COMMAND_PREVIEW_EVENT,
  type MenuContext,
  type RadialCommandPreviewEventDetail,
} from '@/lib/radial-menu-actions';
import { RADIAL_AI_CHAT_DRAFT_EVENT } from '@/lib/radial-ai-commands';

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
    points: [
      { x: 30, y: 50 },
      { x: 60, y: 50 },
    ],
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
    points: [
      { x: 0, y: 0 },
      { x: 100, y: 100 },
    ],
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
const mockDeleteInstance = { mutate: vi.fn() };
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
const mockExpandArchitecture = {
  mutateAsync: vi
    .fn()
    .mockResolvedValue({ circuit: { id: 4, name: 'Expanded Circuit' }, instanceCount: 3, netCount: 2 }),
};
const mockSetActiveView = vi.fn();
const mockToast = vi.fn();
const chatSendListener = vi.fn();
const chatDraftListener = vi.fn();
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
  useDeleteCircuitInstance: () => mockDeleteInstance,
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
  default: (props: Record<string, unknown>) => <g data-testid="mock-ratsnest-overlay" data-nets={String(props.nets)} />,
}));

vi.mock('../ToolButton', () => ({
  default: ({
    icon: _icon,
    label,
    active,
    onClick,
    testId,
  }: {
    icon: unknown;
    label: string;
    active?: boolean;
    onClick: () => void;
    testId: string;
  }) => (
    <button type="button" data-testid={testId} data-active={String(active ?? false)} title={label} onClick={onClick}>
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
  }) =>
    open ? (
      <div data-testid="mock-exact-part-draft-modal">
        {initialSeed?.description ?? ''}
        {initialSeed?.marketplaceSourceUrl ? ` | ${initialSeed.marketplaceSourceUrl}` : ''}
      </div>
    ) : null,
}));

vi.mock('@/components/ui/select', () => ({
  Select: ({
    children,
    onValueChange,
    value,
  }: {
    children: ReactNode;
    onValueChange: (v: string) => void;
    value: string;
  }) => (
    <div data-testid="mock-select" data-value={value} onClick={() => onValueChange('2')}>
      {children}
    </div>
  ),
  SelectTrigger: ({ children, ...props }: { children: ReactNode; 'data-testid'?: string }) => (
    <button type="button" data-testid={props['data-testid'] ?? 'select-trigger'}>
      {children}
    </button>
  ),
  SelectValue: ({ placeholder }: { placeholder: string }) => <span>{placeholder}</span>,
  SelectContent: ({ children }: { children: ReactNode }) => <div>{children}</div>,
  SelectItem: ({ children, value }: { children: ReactNode; value: string }) => <div data-value={value}>{children}</div>,
}));

vi.mock('../HardwareInspectionPanel', () => ({
  default: ({ open }: { open: boolean }) => (open ? <div data-testid="hardware-inspection-panel" /> : null),
}));

vi.mock('@/components/ui/vault-hover-card', () => ({
  VaultHoverCard: ({ children }: { children: ReactNode }) => <>{children}</>,
}));

vi.mock('lucide-react', () => ({
  Bot: () => <svg data-testid="icon-bot" />,
  BarChart3: () => <svg data-testid="icon-bar-chart-3" />,
  User: () => <svg data-testid="icon-user" />,
  ClipboardPaste: () => <svg data-testid="icon-clipboard-paste" />,
  CheckSquare: () => <svg data-testid="icon-check-square" />,
  Copy: () => <svg data-testid="icon-copy" />,
  Crosshair: () => <svg data-testid="icon-crosshair" />,
  Edit: () => <svg data-testid="icon-edit" />,
  Check: () => <svg data-testid="icon-check" />,
  Wrench: () => <svg data-testid="icon-wrench" />,
  FlaskConical: () => <svg data-testid="icon-flask-conical" />,
  GitBranch: () => <svg data-testid="icon-git-branch" />,
  Settings2: () => <svg data-testid="icon-settings-2" />,
  Play: () => <svg data-testid="icon-play" />,
  FileCode: () => <svg data-testid="icon-file-code" />,
  FileJson: () => <svg data-testid="icon-file-json" />,
  FileText: () => <svg data-testid="icon-file-text" />,
  FlipHorizontal2: () => <svg data-testid="icon-flip-horizontal-2" />,
  Gauge: () => <svg data-testid="icon-gauge" />,
  Grid3X3: () => <svg data-testid="icon-grid-3x3" />,
  History: () => <svg data-testid="icon-history" />,
  Link: () => <svg data-testid="icon-link" />,
  Loader2: () => <svg data-testid="icon-loader" />,
  Maximize: () => <svg data-testid="icon-maximize" />,
  MessageSquarePlus: () => <svg data-testid="icon-message-square-plus" />,
  Microscope: () => <svg data-testid="icon-microscope" />,
  Monitor: () => <svg data-testid="icon-monitor" />,
  Move: () => <svg data-testid="icon-move" />,
  Package: () => <svg data-testid="icon-package" />,
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
  ShieldCheck: () => <svg data-testid="icon-shield-check" />,
  SlidersHorizontal: () => <svg data-testid="icon-sliders-horizontal" />,
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
  Box: () => <svg data-testid="icon-box" />,
  PanelRightClose: () => <svg data-testid="icon-panel-right-close" />,
  PanelRightOpen: () => <svg data-testid="icon-panel-right-open" />,
  HelpCircle: () => <svg data-testid="icon-help-circle" />,
  Rocket: () => <svg data-testid="icon-rocket" />,
  Camera: () => <svg data-testid="icon-camera" />,
  FileImage: () => <svg data-testid="icon-file-image" />,
  SearchCheck: () => <svg data-testid="icon-search-check" />,
  ThermometerSun: () => <svg data-testid="icon-thermometer-sun" />,
  Plus: () => <svg data-testid="icon-plus" />,
  Pentagon: () => <svg data-testid="icon-pentagon" />,
  Printer: () => <svg data-testid="icon-printer" />,
  Ruler: () => <svg data-testid="icon-ruler" />,
  RotateCw: () => <svg data-testid="icon-rotate-cw" />,
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

function dispatchBreadboardRadial(
  commandId: string,
  context: Record<string, unknown> = {},
): {
  commandId: string;
  context: Record<string, unknown>;
  source: string;
  handled?: boolean;
} {
  const detail: {
    commandId: string;
    context: Record<string, unknown>;
    source: string;
    handled?: boolean;
  } = {
    commandId,
    context: {
      view: 'breadboard',
      target: 'canvas',
      ...context,
    },
    source: 'radial-menu',
  };
  window.dispatchEvent(new CustomEvent('protopulse:radial-command', { detail }));
  return detail;
}

function dispatchBreadboardRadialPreview(
  commandId: string,
  context: Partial<MenuContext> = {},
): RadialCommandPreviewEventDetail {
  const detail: RadialCommandPreviewEventDetail = {
    commandId,
    context: {
      view: 'breadboard',
      target: 'canvas',
      pointer: { x: 240, y: 180 },
      ...context,
    },
    source: 'radial-menu',
    phase: 'show',
  };
  window.dispatchEvent(new CustomEvent<RadialCommandPreviewEventDetail>(RADIAL_COMMAND_PREVIEW_EVENT, { detail }));
  return detail;
}

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
    mockExpandArchitecture.mutateAsync.mockResolvedValue({
      circuit: { id: 4, name: 'Expanded Circuit' },
      instanceCount: 3,
      netCount: 2,
    });
    window.removeEventListener('protopulse:chat-send', chatSendListener as EventListener);
    window.removeEventListener(RADIAL_AI_CHAT_DRAFT_EVENT, chatDraftListener as EventListener);
    window.removeEventListener('protopulse:open-chat-panel', chatOpenListener as EventListener);
    window.addEventListener('protopulse:chat-send', chatSendListener as EventListener);
    window.addEventListener(RADIAL_AI_CHAT_DRAFT_EVENT, chatDraftListener as EventListener);
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

    it('handles radial add_wire by activating the wire tool', async () => {
      render(<BreadboardView />);

      const detail = dispatchBreadboardRadial('add_wire');

      expect(detail.handled).toBe(true);
      await waitFor(() => {
        expect(screen.getByTestId('tool-wire').getAttribute('data-active')).toBe('true');
      });
    });

    it('handles radial delete on the canvas by activating the delete tool', async () => {
      render(<BreadboardView />);

      const detail = dispatchBreadboardRadial('delete');

      expect(detail.handled).toBe(true);
      await waitFor(() => {
        expect(screen.getByTestId('tool-delete').getAttribute('data-active')).toBe('true');
      });
    });

    it('handles radial show_rails by opening the connectivity explainer', async () => {
      render(<BreadboardView />);

      const detail = dispatchBreadboardRadial('show_rails');

      expect(detail.handled).toBe(true);
      await waitFor(() => {
        expect(screen.getByTestId('connectivity-explainer')).toBeDefined();
      });
    });

    it('renders and clears a breadboard rail radial preview', async () => {
      render(<BreadboardView />);

      dispatchBreadboardRadialPreview('show_rails');

      await waitFor(() => {
        expect(screen.getByTestId('breadboard-radial-adapter-preview')).toHaveAttribute(
          'data-command-id',
          'show_rails',
        );
      });
      expect(screen.getByTestId('breadboard-radial-adapter-preview')).toHaveAttribute('data-board-x');
      expect(screen.getByTestId('breadboard-radial-adapter-preview')).toHaveAttribute('data-board-y');

      window.dispatchEvent(
        new CustomEvent<RadialCommandPreviewEventDetail>(RADIAL_COMMAND_PREVIEW_EVENT, {
          detail: { source: 'radial-menu', phase: 'clear' },
        }),
      );

      await waitFor(() => {
        expect(screen.queryByTestId('breadboard-radial-adapter-preview')).toBeNull();
      });
    });

    it('outlines a placed breadboard part for radial delete previews', async () => {
      mockInstances[0].breadboardX = 70;
      mockInstances[0].breadboardY = 50;

      render(<BreadboardView />);

      dispatchBreadboardRadialPreview('delete', {
        target: 'node',
        targetId: '1',
        targetLabel: 'U1',
      });

      await waitFor(() => {
        expect(screen.getByTestId('breadboard-radial-adapter-preview')).toHaveAttribute('data-command-id', 'delete');
      });
      const preview = screen.getByTestId('breadboard-radial-adapter-preview');
      expect(preview).toHaveAttribute('data-target-kind', 'part');
      expect(preview).toHaveAttribute('data-target-id', '1');
      const outline = screen.getByTestId('breadboard-radial-part-outline');
      expect(Number(outline.getAttribute('width'))).toBeGreaterThan(0);
      expect(Number(outline.getAttribute('height'))).toBeGreaterThan(0);
    });

    it('outlines a breadboard wire path for radial delete previews', async () => {
      render(<BreadboardView />);

      dispatchBreadboardRadialPreview('delete', {
        target: 'wire',
        targetId: '1',
        targetLabel: 'Wire 1',
      });

      await waitFor(() => {
        expect(screen.getByTestId('breadboard-radial-adapter-preview')).toHaveAttribute('data-command-id', 'delete');
      });
      expect(screen.getByTestId('breadboard-radial-adapter-preview')).toHaveAttribute('data-target-kind', 'wire');
      expect(screen.getByTestId('breadboard-radial-wire-outline')).toHaveAttribute('d', 'M 30 50 L 60 50');
    });

    it('handles radial validate_wiring by running the board audit', () => {
      render(<BreadboardView />);

      const detail = dispatchBreadboardRadial('validate_wiring');

      expect(detail.handled).toBe(true);
      expect(mockToast).toHaveBeenCalledWith(
        expect.objectContaining({
          title: expect.stringContaining('Board health'),
        }),
      );
    });

    it('drafts breadboard wiring context to AI chat from a radial command', () => {
      mockInstances[0].breadboardX = 120;
      mockInstances[0].breadboardY = 90;

      render(<BreadboardView />);

      const detail = dispatchBreadboardRadial('ai_breadboard_wiring', {
        target: 'node',
        targetId: '1',
        targetLabel: 'U1',
      });

      expect(detail.handled).toBe(true);
      expect(chatOpenListener).toHaveBeenCalledTimes(1);
      const openEvent = chatOpenListener.mock.calls[0]?.[0] as CustomEvent<{ designAgent?: boolean }>;
      expect(openEvent.detail.designAgent).toBe(false);
      expect(chatDraftListener).toHaveBeenCalledTimes(1);
      expect(chatSendListener).not.toHaveBeenCalled();
      const message = (chatDraftListener.mock.calls[0]?.[0] as CustomEvent<{ message: string }>).detail.message;
      expect(message).toContain('AI intent: breadboard_wiring.');
      expect(message).toContain('Breadboard wiring review: 1 placed part(s)');
      expect(message).toContain('Target: node "U1"');
      expect(message).toContain('Project: Bench Test Project');
      expect(message).toContain('Target part: U1');
      expect(message).toContain('Placed parts:');
      expect(message).toContain('Breadboard jumpers:');
      expect(message).toContain('wire 1 net=1');
      expect(message).toContain('Known nets:');
      expect(message).toContain('- GND id=1');
      expect(message).toContain('Board status:');
    });

    it('handles targeted breadboard rotate and delete commands', () => {
      mockInstances[0].breadboardX = 120;
      mockInstances[0].breadboardY = 90;
      render(<BreadboardView />);
      const context = { target: 'node', targetId: '1', targetLabel: 'U1' };

      expect(dispatchBreadboardRadial('rotate', context).handled).toBe(true);
      expect(mockUpdateInstance.mutate).toHaveBeenCalledWith({
        id: 1,
        circuitId: 1,
        breadboardRotation: 90,
      });

      expect(dispatchBreadboardRadial('delete', context).handled).toBe(true);
      expect(mockDeleteInstance.mutate).toHaveBeenCalledWith({ circuitId: 1, id: 1 });
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

      expect(screen.getByTestId('breadboard-exact-part-resolution-message').textContent).toContain(
        'verified exact part',
      );
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
              breadboardProvenance: 'exact',
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
      expect(screen.getByTestId('breadboard-layout-quality-metric-rail-readiness').textContent).toContain(
        'Rail readiness',
      );
      expect(screen.getByTestId('breadboard-part-inspector-plan').textContent).toContain('6 pending');
      expect(screen.getByTestId('breadboard-coach-action-bridge-power-rails').textContent).toContain('VCC rail bridge');
      expect(screen.getByTestId('breadboard-coach-action-bridge-ground-rails').textContent).toContain(
        'GND rail bridge',
      );
      expect(screen.getByTestId('breadboard-coach-action-hookup-power-pin-3').textContent).toContain('VCC rail jumper');
      expect(screen.getByTestId('breadboard-coach-action-hookup-ground-pin-2').textContent).toContain(
        'GND rail jumper',
      );
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

    it('opens the selected breadboard part in the 3D viewer with trust context', () => {
      mockInstances[0].breadboardX = 70;
      mockInstances[0].breadboardY = 50;
      const viewIn3DListener = vi.fn();
      window.addEventListener('protopulse:breadboard-view-in-3d', viewIn3DListener as EventListener);

      render(<BreadboardView />);

      fireEvent.click(screen.getByTestId('mock-instance-1'));
      fireEvent.click(screen.getByTestId('breadboard-view-in-3d'));

      expect(mockSetActiveView).toHaveBeenCalledWith('viewer_3d');
      expect(mockToast).toHaveBeenCalledWith(
        expect.objectContaining({
          title: 'Opening 3D View',
          description: expect.stringContaining('U1 context sent'),
        }),
      );
      expect(viewIn3DListener).toHaveBeenCalledTimes(1);
      const event = viewIn3DListener.mock.calls[0]?.[0] as CustomEvent<Record<string, unknown>>;
      expect(event.detail).toMatchObject({
        sourceView: 'breadboard',
        projectId: 1,
        circuitId: 1,
        instanceId: 1,
        refDes: 'U1',
        title: 'ATmega328P DIP',
        trustTier: 'connector-defined',
        verificationLevel: 'community-only',
        verificationStatus: 'candidate',
        pinMapConfidence: 'exact',
        readyNow: true,
      });

      window.removeEventListener('protopulse:breadboard-view-in-3d', viewIn3DListener as EventListener);
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
            breadboardProvenance: 'coach',
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
            breadboardProvenance: 'coach',
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
          points: expect.arrayContaining([expect.objectContaining({ y: expect.any(Number) })]),
        }),
      );
      expect(mockCreateWire.mutate).toHaveBeenNthCalledWith(
        4,
        expect.objectContaining({
          circuitId: 1,
          netId: 1,
          view: 'breadboard',
          wireType: 'jump',
          points: expect.arrayContaining([expect.objectContaining({ y: expect.any(Number) })]),
        }),
      );
      expect(mockToast).toHaveBeenCalledWith(
        expect.objectContaining({
          title: 'Bench coach support staged',
        }),
      );
    });

    it('surfaces selected-part coach plan access on the work surface', () => {
      mockInstances[0].breadboardX = 70;
      mockInstances[0].breadboardY = 50;

      render(<BreadboardView />);

      expect(screen.getByTestId('breadboard-work-surface-status').textContent).toContain('Select a part');

      fireEvent.click(screen.getByTestId('mock-instance-1'));

      const coachStatus = screen.getByTestId('breadboard-work-surface-coach');
      expect(coachStatus.textContent).toContain('U1:');
      expect(coachStatus.textContent).toContain('coach move');
      const provenanceStatus = screen.getByTestId('breadboard-work-surface-provenance');
      expect(provenanceStatus.textContent).toContain('CONNECTOR DEFINED');
      expect(screen.getByTestId('breadboard-work-surface-pin-map').textContent).toContain('pin exact');
      expect(screen.getByTestId('breadboard-work-surface-verification').textContent).toContain('community only');
      expect(screen.getByTestId('breadboard-work-surface-stash').textContent).toContain('ready now');
      expect(screen.getByTestId('breadboard-work-surface-verification-status').textContent).toContain('candidate');

      fireEvent.click(screen.getByTestId('button-breadboard-surface-coach-toggle'));

      expect(screen.getByTestId('breadboard-coach-plan-overlay')).toBeDefined();
      expect(screen.getByTestId('button-breadboard-surface-coach-toggle').textContent).toContain('Hide plan');
    });

    it('keeps selected-part View in 3D reachable from the collapsed work surface', () => {
      mockInstances[0].breadboardX = 70;
      mockInstances[0].breadboardY = 50;
      const viewIn3DListener = vi.fn();
      window.addEventListener('protopulse:breadboard-view-in-3d', viewIn3DListener as EventListener);

      render(<BreadboardView />);

      expect(screen.queryByTestId('button-breadboard-surface-view-in-3d')).toBeNull();

      fireEvent.click(screen.getByTestId('mock-instance-1'));
      const surfaceStatus = screen.getByTestId('breadboard-work-surface-status');
      const surfaceToggle = screen.getByTestId('button-breadboard-surface-status-toggle');
      expect(screen.getByTestId('breadboard-work-surface-3d').textContent).toContain('U1');

      fireEvent.click(surfaceToggle);
      expect(surfaceStatus.getAttribute('data-collapsed')).toBe('true');
      expect(screen.queryByTestId('breadboard-work-surface-status-body')).toBeNull();

      fireEvent.click(screen.getByTestId('button-breadboard-surface-view-in-3d'));

      expect(mockSetActiveView).toHaveBeenCalledWith('viewer_3d');
      expect(viewIn3DListener).toHaveBeenCalledTimes(1);
      const event = viewIn3DListener.mock.calls[0]?.[0] as CustomEvent<Record<string, unknown>>;
      expect(event.detail).toMatchObject({
        sourceView: 'breadboard',
        refDes: 'U1',
        trustTier: 'connector-defined',
        pinMapConfidence: 'exact',
        readyNow: true,
      });

      window.removeEventListener('protopulse:breadboard-view-in-3d', viewIn3DListener as EventListener);
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
            breadboardProvenance: 'coach',
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
            coordToPixel({ type: 'rail', rail: 'left_pos', index: 2 }),
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
            coordToPixel({ type: 'rail', rail: 'left_neg', index: 1 }),
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
            coordToPixel({ type: 'rail', rail: 'left_pos', index: 14 }),
            { x: 95, y: 193 },
            coordToPixel({ type: 'rail', rail: 'right_pos', index: 14 }),
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
            coordToPixel({ type: 'rail', rail: 'left_neg', index: 14 }),
            { x: 88, y: 193 },
            coordToPixel({ type: 'rail', rail: 'right_neg', index: 14 }),
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

    it('keeps board health visible, runnable, and collapsible on the work surface', async () => {
      mockInstances[0].breadboardX = 70;
      mockInstances[0].breadboardY = 50;

      render(<BreadboardView />);

      const surfaceStatus = screen.getByTestId('breadboard-work-surface-status');
      const surfaceToggle = screen.getByTestId('button-breadboard-surface-status-toggle');
      expect(surfaceStatus.getAttribute('data-resizable')).toBe('true');
      expect(surfaceStatus.getAttribute('data-resize-axis')).toBe('both');
      expect(surfaceToggle.getAttribute('aria-expanded')).toBe('true');
      expect(screen.getByTestId('breadboard-work-surface-health').textContent).toContain('Not checked');

      fireEvent.click(screen.getByTestId('button-breadboard-surface-audit'));

      await waitFor(() => {
        expect(screen.getByTestId('breadboard-work-surface-health').textContent).toContain('score');
      });

      fireEvent.click(surfaceToggle);
      expect(surfaceStatus.getAttribute('data-collapsed')).toBe('true');
      expect(surfaceToggle.getAttribute('aria-expanded')).toBe('false');
      expect(screen.queryByTestId('breadboard-work-surface-status-body')).toBeNull();
      expect(surfaceStatus.textContent).toContain('Board Health');
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
    expect(callArgs.properties).toMatchObject({ breadboardProvenance: 'project' });
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
    expect(callArgs.properties).toMatchObject({ breadboardProvenance: 'starter' });
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
    [PROTOPULSE_DRAG_TYPE]: nodeType,
    [PROTOPULSE_DRAG_LABEL]: label,
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
    const hooksModule = (await import('@/lib/circuit-editor/hooks')) as Record<string, unknown>;
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
    const hooksModule = (await import('@/lib/circuit-editor/hooks')) as Record<string, unknown>;
    const originalUseCircuitDesigns = hooksModule.useCircuitDesigns;
    hooksModule.useCircuitDesigns = vi.fn().mockReturnValue({ data: [], isLoading: false });

    render(<BreadboardView />);
    expect(screen.getByTestId('breadboard-empty')).toBeDefined();

    // Restore
    hooksModule.useCircuitDesigns = originalUseCircuitDesigns;
  });

  it('can create the first breadboard circuit directly from the empty state', async () => {
    const hooksModule = (await import('@/lib/circuit-editor/hooks')) as Record<string, unknown>;
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
