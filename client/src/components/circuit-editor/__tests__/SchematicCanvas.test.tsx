import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import React from 'react';
import type { ReactNode } from 'react';
import type { Node, Edge } from '@xyflow/react';
import SchematicCanvas from '../SchematicCanvas';

// -------------------------------------------------------------------
// Mocks
// -------------------------------------------------------------------

const mockCreateInstance = { mutateAsync: vi.fn() };
const mockUpdateDesign = { mutateAsync: vi.fn() };
const mockUpdateInstance = { mutate: vi.fn(), mutateAsync: vi.fn() };
const mockDeleteInstance = { mutate: vi.fn() };
const mockCreateNet = { mutateAsync: vi.fn() };
const mockUpdateNet = { mutate: vi.fn() };
const mockDeleteNet = { mutate: vi.fn() };
const mockToast = vi.fn();

const mockUseCircuitDesign = vi.fn().mockReturnValue({ data: { id: 1, settings: {} } });
const mockUseCircuitInstances = vi.fn().mockReturnValue({ data: [] });
const mockUseCircuitNets = vi.fn().mockReturnValue({ data: [] });
const mockUseCircuitWires = vi.fn().mockReturnValue({ data: [] });
const mockUseComponentParts = vi.fn().mockReturnValue({ data: [] });

vi.mock('@/lib/contexts/project-id-context', () => ({
  useProjectId: () => 1,
}));

vi.mock('@/lib/contexts/architecture-context', () => ({
  useArchitecture: () => ({
    pushUndoState: vi.fn(),
  }),
}));

vi.mock('@/lib/circuit-editor/hooks', () => ({
  useCircuitDesign: () => mockUseCircuitDesign(),
  useCircuitInstances: () => mockUseCircuitInstances(),
  useCircuitNets: () => mockUseCircuitNets(),
  useCircuitWires: () => mockUseCircuitWires(),
  useChildDesigns: () => ({ data: [] }),
  useHierarchicalPorts: () => ({ data: [] }),
  useCreateCircuitInstance: () => mockCreateInstance,
  useUpdateCircuitDesign: () => mockUpdateDesign,
  useUpdateCircuitInstance: () => mockUpdateInstance,
  useDeleteCircuitInstance: () => mockDeleteInstance,
  useCreateCircuitNet: () => mockCreateNet,
  useUpdateCircuitNet: () => mockUpdateNet,
  useDeleteCircuitNet: () => mockDeleteNet,
  useCreateCircuitWire: () => ({ mutate: vi.fn() }),
  useDeleteCircuitWire: () => ({ mutate: vi.fn() }),
}));

vi.mock('@/lib/component-editor/hooks', () => ({
  useComponentParts: () => mockUseComponentParts(),
}));

vi.mock('@/hooks/use-toast', () => ({
  useToast: () => ({ toast: mockToast }),
}));

// Mock React Flow
const mockFitView = vi.fn();
const mockScreenToFlowPosition = vi.fn().mockReturnValue({ x: 100, y: 100 });
const mockUseNodesState = vi.fn().mockImplementation((initial: Node[]) => [initial, vi.fn(), vi.fn()]);
const mockUseEdgesState = vi.fn().mockImplementation((initial: Edge[]) => [initial, vi.fn(), vi.fn()]);

vi.mock('@xyflow/react', () => ({
  ReactFlow: ({ children, nodes, edges }: { children?: ReactNode; nodes?: Node[]; edges?: Edge[] }) => (
    <div data-testid="react-flow" data-node-count={nodes?.length || 0} data-edge-count={edges?.length || 0}>
      {children}
    </div>
  ),
  ReactFlowProvider: ({ children }: { children?: ReactNode }) => <>{children}</>,
  useReactFlow: () => ({
    fitView: mockFitView,
    screenToFlowPosition: mockScreenToFlowPosition,
    getNodes: vi.fn(() => []),
  }),
  useNodesState: (initial: Node[]) => mockUseNodesState(initial),
  useEdgesState: (initial: Edge[]) => mockUseEdgesState(initial),
  Background: () => <div data-testid="rf-background" />,
  Controls: () => <div data-testid="rf-controls" />,
  MiniMap: () => <div data-testid="rf-minimap" />,
  ConnectionMode: { Loose: 'loose' },
  SelectionMode: { Partial: 'partial' },
}));

// Mock Tooltip and ContextMenu
vi.mock('@/components/ui/styled-tooltip', () => ({
  StyledTooltip: ({ children }: { children?: ReactNode }) => <>{children}</>,
}));

vi.mock('@/components/ui/context-menu', () => ({
  ContextMenu: ({ children }: { children?: ReactNode }) => <>{children}</>,
  ContextMenuTrigger: ({ children }: { children?: ReactNode }) => <>{children}</>,
  ContextMenuContent: ({ children }: { children?: ReactNode }) => <div data-testid="context-menu">{children}</div>,
  ContextMenuItem: ({ children, onSelect }: { children?: ReactNode; onSelect?: () => void }) => <button type="button" onClick={onSelect}>{children}</button>,
  ContextMenuSeparator: () => <hr />,
}));

// Mock BOM context (used by SchematicCanvasInner for component sync)
vi.mock('@/lib/contexts/bom-context', () => ({
  useBom: () => ({
    bom: [],
    bomSettings: { maxCost: 50, batchSize: 1000, inStockOnly: true, manufacturingDate: new Date() },
    setBomSettings: vi.fn(),
    addBomItem: vi.fn(),
    deleteBomItem: vi.fn(),
    updateBomItem: vi.fn(),
  }),
}));

// Mock simulation context (used by SchematicNetEdge and SimulationVisualOverlay)
vi.mock('@/lib/contexts/simulation-context', () => ({
  useSimulation: () => ({
    isLive: false,
    setIsLive: vi.fn(),
    dcResult: null,
    setDCResult: vi.fn(),
    componentVisualStates: new Map(),
    setComponentVisualStates: vi.fn(),
    wireVisualStates: new Map(),
    setWireVisualStates: vi.fn(),
    isSimRunning: false,
    setIsSimRunning: vi.fn(),
    activeAnalysisType: 'dcop',
    setActiveAnalysisType: vi.fn(),
    clearStates: vi.fn(),
  }),
}));

// Mock SimulationVisualOverlay
vi.mock('../SimulationVisualOverlay', () => ({ default: () => <div data-testid="sim-visual-overlay" /> }));

// Mock NetDrawingTool and SchematicToolbar
vi.mock('../NetDrawingTool', () => ({ default: () => <div data-testid="net-drawing-tool" /> }));
vi.mock('../SchematicToolbar', () => ({ default: () => <div data-testid="schematic-toolbar" /> }));

// -------------------------------------------------------------------
// Helpers
// -------------------------------------------------------------------

function createTestQueryClient() {
  return new QueryClient({
    defaultOptions: {
      queries: { retry: false, gcTime: 0 },
      mutations: { retry: false },
    },
  });
}

function renderCanvas(circuitId = 1) {
  const qc = createTestQueryClient();
  return render(
    <QueryClientProvider client={qc}>
      <SchematicCanvas circuitId={circuitId} />
    </QueryClientProvider>,
  );
}

// -------------------------------------------------------------------
// Tests
// -------------------------------------------------------------------

describe('SchematicCanvas', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // Mock clipboard
    vi.stubGlobal('navigator', {
      clipboard: {
        writeText: vi.fn().mockResolvedValue(undefined),
        readText: vi.fn().mockResolvedValue(''),
      },
      platform: 'Linux',
    });
  });

  it('renders without crashing', () => {
    renderCanvas();
    expect(screen.getByTestId('react-flow')).toBeDefined();
  });

  // E2E-950, E2E-966: empty-state heading must NOT persist in DOM once populated
  // Regression lock-in: SchematicCanvas.tsx must conditionally render <EmptyState>
  // (not CSS-hide it) so screen readers don't announce "Empty Schematic" over a
  // populated canvas. Current code path: line ~920
  //   `{(!instances || instances.length === 0) && <EmptyState title="Empty Schematic" ... />}`
  // If someone regresses this to `className={hidden}`-style hiding, this test will fail.
  it('does not render Empty Schematic heading when instances is populated (E2E-950, E2E-966)', () => {
    mockUseCircuitInstances.mockReturnValue({
      data: [
        { id: 101, circuitId: 1, partId: 1, referenceDesignator: 'R1', schematicX: 0, schematicY: 0, schematicRotation: 0, properties: {} },
      ],
    });

    renderCanvas();

    // Empty-state heading must not be in the DOM (not merely hidden)
    expect(screen.queryByTestId('empty-state-title')).toBeNull();
    expect(screen.queryByText(/Empty Schematic/i)).toBeNull();
  });

  it('renders Empty Schematic heading when instances is empty (E2E-950 inverse)', () => {
    mockUseCircuitInstances.mockReturnValue({ data: [] });

    renderCanvas();

    // When truly empty, the heading IS shown
    expect(screen.getByTestId('empty-state-title').textContent).toMatch(/Empty Schematic/i);
  });

  // E2E-225, E2E-856: Empty-state "Add Component" button must dispatch the
  // protopulse:focus-component-search event so the UnifiedComponentSearch
  // palette (mounted at workspace scope in ProjectWorkspace.tsx) opens.
  // Audit previously observed "enters place mode but no part selected" — that
  // symptom was the listener being absent (palette never mounted). The handler
  // contract is: click → dispatch the event. Locking that in here.
  it('empty-state Add Component dispatches focus-component-search event (E2E-225, E2E-856)', () => {
    mockUseCircuitInstances.mockReturnValue({ data: [] });

    const eventSpy = vi.fn();
    window.addEventListener('protopulse:focus-component-search', eventSpy);

    try {
      renderCanvas();

      const btn = screen.getByTestId('button-add-schematic-component');
      fireEvent.click(btn);

      expect(eventSpy).toHaveBeenCalledTimes(1);
      const evt = eventSpy.mock.calls[0][0] as Event;
      expect(evt.type).toBe('protopulse:focus-component-search');
    } finally {
      window.removeEventListener('protopulse:focus-component-search', eventSpy);
    }
  });

  it('handles Ctrl+C to copy selected nodes', async () => {
    const mockInstances = [
      { id: 101, partId: 1, referenceDesignator: 'R1', schematicX: 0, schematicY: 0, schematicRotation: 0, properties: {} }
    ];

    mockUseCircuitInstances.mockReturnValue({ data: mockInstances });

    // Mock nodes state to have a selected node
    const mockNodes = [
      { id: 'instance-101', type: 'schematic-instance', position: { x: 0, y: 0 }, data: { instanceId: 101 }, selected: true }
    ];

    mockUseNodesState.mockReturnValue([mockNodes, vi.fn(), vi.fn()]);

    renderCanvas();

    fireEvent.keyDown(window, { key: 'c', ctrlKey: true });

    await waitFor(() => {
      expect(navigator.clipboard.writeText).toHaveBeenCalled();
      const callArgs = vi.mocked(navigator.clipboard.writeText).mock.calls[0][0];
      const bundle = JSON.parse(callArgs);
      expect(bundle.type).toBe('protopulse-schematic-bundle');
      expect(bundle.instances).toHaveLength(1);
      expect(bundle.instances[0].oldId).toBe(101);
    });

    expect(mockToast).toHaveBeenCalledWith(expect.objectContaining({
      title: 'Copied to clipboard',
    }));
  });

  it('handles Ctrl+V to paste nodes', async () => {
    const bundle = {
      type: 'protopulse-schematic-bundle',
      instances: [
        { partId: 1, referenceDesignator: 'R1', schematicX: 10, schematicY: 10, schematicRotation: 0, properties: {}, oldId: 101 }
      ],
      nets: []
    };

    // Ensure clean state for this test
    mockUseCircuitInstances.mockReturnValue({ data: [] });
    mockUseComponentParts.mockReturnValue({ data: [{ id: 1, meta: { family: 'resistor' } }] });

    vi.mocked(navigator.clipboard.readText).mockResolvedValue(JSON.stringify(bundle));
    mockCreateInstance.mutateAsync.mockResolvedValue({ id: 201 });

    renderCanvas();

    fireEvent.keyDown(window, { key: 'v', ctrlKey: true });

    await waitFor(() => {
      expect(mockCreateInstance.mutateAsync).toHaveBeenCalledWith(expect.objectContaining({
        partId: 1,
        referenceDesignator: 'R1',
      }));
    });

    expect(mockToast).toHaveBeenCalledWith(expect.objectContaining({
      title: 'Pasted successfully',
    }));
  });
});
