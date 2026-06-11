import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import React from 'react';
import type { ReactNode } from 'react';
import type { SchematicNode, SchematicEdge } from '../schematic/flow-types';
import SchematicCanvas from '../SchematicCanvas';
import {
  RADIAL_COMMAND_EVENT,
  RADIAL_COMMAND_PREVIEW_EVENT,
  type MenuContext,
  type RadialCommandEventDetail,
  type RadialCommandPreviewEventDetail,
} from '@/lib/radial-menu-actions';
import { RADIAL_AI_CHAT_DRAFT_EVENT } from '@/lib/radial-ai-commands';

// -------------------------------------------------------------------
// Mocks
// -------------------------------------------------------------------

const mockCreateInstance = { mutateAsync: vi.fn() };
const mockUpdateDesign = { mutate: vi.fn(), mutateAsync: vi.fn() };
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
const mockUseNodesState = vi.fn().mockImplementation((initial: SchematicNode[]) => [initial, vi.fn(), vi.fn()]);
const mockUseEdgesState = vi.fn().mockImplementation((initial: SchematicEdge[]) => [initial, vi.fn(), vi.fn()]);

vi.mock('@/lib/xyflow-compat', () => ({
  ReactFlow: ({ children, nodes, edges }: { children?: ReactNode; nodes?: SchematicNode[]; edges?: SchematicEdge[] }) => (
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
  useNodesState: (initial: SchematicNode[]) => mockUseNodesState(initial),
  useEdgesState: (initial: SchematicEdge[]) => mockUseEdgesState(initial),
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
  ContextMenuItem: ({
    children,
    disabled,
    onSelect,
    textValue: _textValue,
    ...props
  }: {
    children?: ReactNode;
    disabled?: boolean;
    onSelect?: () => void;
    textValue?: string;
  } & Record<string, unknown>) => (
    <button type="button" disabled={disabled} onClick={onSelect} {...props}>{children}</button>
  ),
  ContextMenuSeparator: () => <hr data-testid="context-menu-separator" />,
  ContextMenuShortcut: ({ children, ...props }: { children?: ReactNode } & Record<string, unknown>) => <span {...props}>{children}</span>,
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

function dispatchSchematicRadial(commandId: string, context: Partial<MenuContext> = {}): RadialCommandEventDetail {
  const detail: RadialCommandEventDetail = {
    commandId,
    context: {
      view: 'schematic',
      target: 'canvas',
      ...context,
    },
    source: 'radial-menu',
  };
  window.dispatchEvent(new CustomEvent<RadialCommandEventDetail>(RADIAL_COMMAND_EVENT, { detail }));
  return detail;
}

function dispatchSchematicRadialPreview(
  commandId: string,
  context: Partial<MenuContext> = {},
): RadialCommandPreviewEventDetail {
  const detail: RadialCommandPreviewEventDetail = {
    commandId,
    context: {
      view: 'schematic',
      target: 'canvas',
      pointer: { x: 240, y: 180 },
      ...context,
    },
    phase: 'show',
    source: 'radial-menu',
  };
  window.dispatchEvent(new CustomEvent<RadialCommandPreviewEventDetail>(RADIAL_COMMAND_PREVIEW_EVENT, { detail }));
  return detail;
}

// -------------------------------------------------------------------
// Tests
// -------------------------------------------------------------------

describe('SchematicCanvas', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockUseCircuitDesign.mockReturnValue({ data: { id: 1, settings: {} } });
    mockUseCircuitInstances.mockReturnValue({ data: [] });
    mockUseCircuitNets.mockReturnValue({ data: [] });
    mockUseComponentParts.mockReturnValue({ data: [] });
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

  it('renders the registry-backed schematic linear context menu fallback', () => {
    renderCanvas();

    expect(screen.getByTestId('ctx-command-add_component')).toHaveTextContent('Add Part');
    expect(screen.getByTestId('ctx-command-add_power')).toHaveTextContent('Add Power');
    expect(screen.getByTestId('ctx-command-fit_view')).toHaveTextContent('Fit');
    expect(screen.getByTestId('ctx-command-toggle_grid')).toHaveTextContent('Toggle Grid');
    expect(screen.getByTestId('ctx-command-run_erc')).toHaveTextContent('ERC');
  });

  it('keeps selected-component schematic commands disabled until one instance is selected', () => {
    renderCanvas();

    expect(screen.getByTestId('ctx-command-replace_component')).toBeDisabled();
    expect(screen.getByTestId('ctx-command-replace_component')).toHaveAttribute('title', 'Select one schematic component first.');
    expect(screen.getByTestId('ctx-command-add_decoupling')).toBeDisabled();
    expect(screen.getByTestId('ctx-command-add_decoupling')).toHaveAttribute('title', 'Select one schematic component first.');
  });

  it('handles radial add_component through the schematic adapter', () => {
    const eventSpy = vi.fn();
    window.addEventListener('protopulse:focus-component-search', eventSpy);

    try {
      renderCanvas();
      const detail = dispatchSchematicRadial('add_component');

      expect(detail.handled).toBe(true);
      expect(eventSpy).toHaveBeenCalledTimes(1);
    } finally {
      window.removeEventListener('protopulse:focus-component-search', eventSpy);
    }
  });

  it('handles radial fit_view through the schematic adapter', () => {
    renderCanvas();
    const detail = dispatchSchematicRadial('fit_view');

    expect(detail.handled).toBe(true);
    expect(mockFitView).toHaveBeenCalledWith({ padding: 0.2 });
  });

  it('handles radial add_power by adding a VCC symbol', () => {
    renderCanvas();
    const detail = dispatchSchematicRadial('add_power');

    expect(detail.handled).toBe(true);
    expect(mockUpdateDesign.mutate).toHaveBeenCalledWith(expect.objectContaining({
      projectId: 1,
      id: 1,
      settings: expect.objectContaining({
        powerSymbols: [
          expect.objectContaining({
            type: 'VCC',
            netName: 'VCC',
            x: 100,
            y: 100,
          }),
        ],
      }),
    }));
  });

  it('handles radial run_erc by dispatching the schematic ERC event', () => {
    const eventSpy = vi.fn();
    window.addEventListener('protopulse:run-erc', eventSpy);

    try {
      renderCanvas();
      const detail = dispatchSchematicRadial('run_erc');

      expect(detail.handled).toBe(true);
      expect(eventSpy).toHaveBeenCalledTimes(1);
    } finally {
      window.removeEventListener('protopulse:run-erc', eventSpy);
    }
  });

  it('drafts schematic review context to AI chat from a radial command', () => {
    const draftSpy = vi.fn();
    const openSpy = vi.fn();
    mockUseCircuitDesign.mockReturnValue({ data: { id: 1, name: 'Main Circuit', settings: {} } });
    mockUseCircuitInstances.mockReturnValue({
      data: [
        { id: 101, circuitId: 1, partId: 1, referenceDesignator: 'U1', schematicX: 42, schematicY: 84, schematicRotation: 0, properties: {} },
      ],
    });
    mockUseCircuitNets.mockReturnValue({ data: [{ id: 7, circuitId: 1, name: 'VCC', color: '#ff0000' }] });
    window.addEventListener(RADIAL_AI_CHAT_DRAFT_EVENT, draftSpy);
    window.addEventListener('protopulse:open-chat-panel', openSpy);

    try {
      renderCanvas();
      const detail = dispatchSchematicRadial('ai_schematic_review', {
        target: 'node',
        targetId: 'instance-101',
        targetLabel: 'U1',
      });

      expect(detail.handled).toBe(true);
      expect(openSpy).toHaveBeenCalledWith(expect.objectContaining({
        detail: { designAgent: false },
      }));
      expect(draftSpy).toHaveBeenCalledTimes(1);
      const message = (draftSpy.mock.calls[0][0] as CustomEvent<{ message: string }>).detail.message;
      expect(message).toContain('AI intent: review_schematic.');
      expect(message).toContain('Schematic review: 1 symbol(s), 1 net(s)');
      expect(message).toContain('Target: node "U1"');
      expect(message).toContain('Circuit: Main Circuit');
      expect(message).toContain('Known nets:');
      expect(message).toContain('- VCC id=7');
    } finally {
      window.removeEventListener(RADIAL_AI_CHAT_DRAFT_EVENT, draftSpy);
      window.removeEventListener('protopulse:open-chat-panel', openSpy);
    }
  });

  it('renders and clears a schematic-space radial wire preview', async () => {
    renderCanvas();

    dispatchSchematicRadialPreview('add_wire');

    await waitFor(() => {
      expect(screen.getByTestId('schematic-radial-adapter-preview')).toHaveAttribute('data-command-id', 'add_wire');
    });
    expect(screen.getByTestId('schematic-radial-adapter-preview')).toHaveAttribute('data-flow-x', '100');
    expect(screen.getByTestId('schematic-radial-adapter-preview')).toHaveAttribute('data-flow-y', '100');
    expect(screen.getByText('Wire anchor')).toBeDefined();

    window.dispatchEvent(new CustomEvent<RadialCommandPreviewEventDetail>(RADIAL_COMMAND_PREVIEW_EVENT, {
      detail: { phase: 'clear', source: 'radial-menu' },
    }));

    await waitFor(() => {
      expect(screen.queryByTestId('schematic-radial-adapter-preview')).toBeNull();
    });
  });

  it('outlines a schematic node target for radial delete previews', async () => {
    mockUseCircuitInstances.mockReturnValue({
      data: [
        { id: 101, circuitId: 1, partId: 1, referenceDesignator: 'R1', schematicX: 160, schematicY: 120, schematicRotation: 0, properties: {} },
      ],
    });

    renderCanvas();

    dispatchSchematicRadialPreview('delete', {
      target: 'node',
      targetId: '101',
      targetLabel: 'R1',
    });

    await waitFor(() => {
      expect(screen.getByTestId('schematic-radial-adapter-preview')).toHaveAttribute('data-command-id', 'delete');
    });
    const preview = screen.getByTestId('schematic-radial-adapter-preview');
    expect(preview).toHaveAttribute('data-target-kind', 'node');
    expect(preview).toHaveAttribute('data-target-id', 'instance-101');
    expect(Number(preview.getAttribute('data-target-width'))).toBeGreaterThan(0);
    expect(Number(preview.getAttribute('data-target-height'))).toBeGreaterThan(0);
    expect(screen.getByTestId('schematic-radial-target-outline')).toBeDefined();
    expect(screen.getByText('R1')).toBeDefined();
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
