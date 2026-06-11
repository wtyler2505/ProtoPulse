import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, within, act } from '@testing-library/react';
import { QueryClientProvider } from '@tanstack/react-query';
import { createTestQueryClient } from '@/test-utils/createTestQueryClient';
import React from 'react';
import { RADIAL_AI_CHAT_DRAFT_EVENT } from '@/lib/radial-ai-commands';

// -------------------------------------------------------------------
// Mocks
// -------------------------------------------------------------------

const {
  mockSetNodes,
  mockSetEdges,
  mockPushUndoState,
  mockUndo,
  mockRedo,
  mockSetSelectedNodeId,
  mockSetPendingComponentPartId,
  mockAddMessage,
  mockSetIsGenerating,
  mockAddOutputLog,
  mockSetActiveView,
  mockAddBomItem,
  mockSaveV3CompileRun,
  mockSaveV3SwarmTasks,
  mockSaveV3VerifiedFacts,
} = vi.hoisted(() => ({
  mockSetNodes: vi.fn(),
  mockSetEdges: vi.fn(),
  mockPushUndoState: vi.fn(),
  mockUndo: vi.fn(),
  mockRedo: vi.fn(),
  mockSetSelectedNodeId: vi.fn(),
  mockSetPendingComponentPartId: vi.fn(),
  mockAddMessage: vi.fn(),
  mockSetIsGenerating: vi.fn(),
  mockAddOutputLog: vi.fn(),
  mockSetActiveView: vi.fn(),
  mockAddBomItem: vi.fn(),
  mockSaveV3CompileRun: vi.fn(),
  mockSaveV3SwarmTasks: vi.fn(),
  mockSaveV3VerifiedFacts: vi.fn(),
}));

let mockNodes: Array<{
  id: string;
  type?: string;
  position: { x: number; y: number };
  data: Record<string, unknown>;
  selected?: boolean;
}> = [];
let mockEdges: Array<{
  id: string;
  source: string;
  target: string;
}> = [];
let mockIsGenerating = false;
let mockSelectedNodeId: string | null = null;

vi.mock('@/lib/contexts/architecture-context', () => ({
  useArchitecture: () => ({
    nodes: mockNodes,
    edges: mockEdges,
    setNodes: mockSetNodes,
    setEdges: mockSetEdges,
    focusNodeId: null,
    selectedNodeId: mockSelectedNodeId,
    setSelectedNodeId: mockSetSelectedNodeId,
    pushUndoState: mockPushUndoState,
    undo: mockUndo,
    redo: mockRedo,
    setPendingComponentPartId: mockSetPendingComponentPartId,
  }),
}));

vi.mock('@/lib/contexts/chat-context', () => ({
  useChat: () => ({
    isGenerating: mockIsGenerating,
    addMessage: mockAddMessage,
    setIsGenerating: mockSetIsGenerating,
  }),
}));

vi.mock('@/lib/contexts/output-context', () => ({
  useOutput: () => ({
    addOutputLog: mockAddOutputLog,
  }),
}));

vi.mock('@/lib/contexts/project-meta-context', () => ({
  useProjectMeta: () => ({
    setActiveView: mockSetActiveView,
  }),
}));

vi.mock('@/lib/contexts/bom-context', () => ({
  useBom: () => ({
    bom: [],
    bomSettings: { maxCost: 50, batchSize: 1000, inStockOnly: true, manufacturingDate: new Date() },
    setBomSettings: vi.fn(),
    addBomItem: mockAddBomItem,
    deleteBomItem: vi.fn(),
    updateBomItem: vi.fn(),
  }),
}));

vi.mock('@/lib/clipboard', () => ({
  copyToClipboard: vi.fn(),
}));

vi.mock('@/lib/contexts/project-id-context', () => ({
  useProjectId: () => 1,
}));

vi.mock('@/lib/circuit-editor/hooks', () => ({
  useCircuitDesigns: () => ({ data: [], isLoading: false }),
  useCreateCircuitDesign: () => ({ mutateAsync: vi.fn().mockResolvedValue({ id: 1, name: 'Main Schematic' }) }),
  useCreateCircuitInstance: () => ({ mutateAsync: vi.fn().mockResolvedValue({ id: 1 }) }),
}));

vi.mock('@/lib/v3-architecture-api', () => ({
  saveV3CompileRun: mockSaveV3CompileRun,
  saveV3SwarmTasks: mockSaveV3SwarmTasks,
  saveV3VerifiedFacts: mockSaveV3VerifiedFacts,
}));

vi.mock('@/hooks/useSyncedFlowState', () => ({
  useSyncedFlowState: () => ({
    nodeInteracted: { current: false },
    edgeInteracted: { current: false },
  }),
}));

vi.mock('@/components/ui/styled-tooltip', () => ({
  StyledTooltip: ({ children }: { children: React.ReactNode }) => <>{children}</>,
}));

// Mock context menu — render a simplified version
vi.mock('@/components/ui/context-menu', () => ({
  ContextMenu: ({ children }: { children: React.ReactNode }) => <>{children}</>,
  ContextMenuTrigger: ({ children }: { children: React.ReactNode }) => <>{children}</>,
  ContextMenuContent: ({ children }: { children: React.ReactNode }) => (
    <div data-testid="context-menu-content">{children}</div>
  ),
  ContextMenuItem: ({
    children,
    onSelect,
    textValue: _textValue,
    ...props
  }: { children: React.ReactNode; onSelect?: () => void; textValue?: string } & Record<string, unknown>) => (
    <button type="button" onClick={onSelect} {...props}>
      {children}
    </button>
  ),
  ContextMenuSeparator: () => <hr />,
  ContextMenuShortcut: ({ children, ...props }: { children: React.ReactNode } & Record<string, unknown>) => (
    <span {...props}>{children}</span>
  ),
  ContextMenuSub: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  ContextMenuSubTrigger: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  ContextMenuSubContent: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
}));

// Mock AssetManager
vi.mock('@/components/panels/AssetManager', () => ({
  default: ({ onClose }: { onClose?: () => void }) => (
    <div data-testid="asset-manager">
      <button type="button" data-testid="asset-manager-close" onClick={onClose}>
        Close
      </button>
    </div>
  ),
}));

// Mock @dnd-kit/core — useDndMonitor requires DndContext which tests don't provide
vi.mock('@dnd-kit/core', () => ({
  useDroppable: () => ({ setNodeRef: vi.fn(), isOver: false }),
  useDndMonitor: vi.fn(),
}));

// Mock @dnd-kit/modifiers (imported transitively via dnd-context)
vi.mock('@dnd-kit/modifiers', () => ({
  restrictToWindowEdges: vi.fn(),
}));

// Mock the xyflow compat CSS shim so PostCSS/Tailwind v4 doesn't choke on it
vi.mock('@/lib/xyflow-style', () => ({}));

// Mock xyflow compat — the component wraps ArchitectureFlow in ReactFlowProvider
const mockFitView = vi.fn();
const mockScreenToFlowPosition = vi.fn().mockReturnValue({ x: 100, y: 100 });
const mockFlowToScreenPosition = vi.fn().mockReturnValue({ x: 240, y: 160 });
const mockSetCenter = vi.fn();

vi.mock('@/lib/xyflow-compat', () => ({
  ReactFlow: ({ children, nodes, edges }: { children?: React.ReactNode; nodes: unknown[]; edges: unknown[] }) => (
    <div data-testid="react-flow" data-node-count={nodes.length} data-edge-count={edges.length}>
      {children}
    </div>
  ),
  ReactFlowProvider: ({ children }: { children: React.ReactNode }) => <>{children}</>,
  useReactFlow: () => ({
    fitView: mockFitView,
    screenToFlowPosition: mockScreenToFlowPosition,
    flowToScreenPosition: mockFlowToScreenPosition,
    setCenter: mockSetCenter,
  }),
  useNodesState: (initial: unknown[]) => [initial, vi.fn(), vi.fn()],
  useEdgesState: (initial: unknown[]) => [initial, vi.fn(), vi.fn()],
  addEdge: vi.fn(),
  Background: () => <div data-testid="rf-background" />,
  Controls: () => <div data-testid="rf-controls" />,
  MiniMap: () => <div data-testid="rf-minimap" />,
  SelectionMode: { Full: 0, Partial: 1 },
}));

// -------------------------------------------------------------------
// Helpers
// -------------------------------------------------------------------

import ArchitectureView from '@/components/views/ArchitectureView';
import { RADIAL_COMMAND_EVENT, type MenuContext, type RadialCommandEventDetail } from '@/lib/radial-menu-actions';

function renderArchView() {
  const qc = createTestQueryClient();
  return render(
    <QueryClientProvider client={qc}>
      <ArchitectureView />
    </QueryClientProvider>,
  );
}

function dispatchRadial(commandId: string, context: MenuContext): RadialCommandEventDetail {
  const detail: RadialCommandEventDetail = { commandId, context, source: 'radial-menu' };
  act(() => {
    window.dispatchEvent(new CustomEvent<RadialCommandEventDetail>(RADIAL_COMMAND_EVENT, { detail }));
  });
  return detail;
}

// -------------------------------------------------------------------
// Tests
// -------------------------------------------------------------------

describe('ArchitectureView', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockNodes = [];
    mockEdges = [];
    mockIsGenerating = false;
    mockSelectedNodeId = null;
    mockSaveV3CompileRun.mockResolvedValue({
      id: 99,
      projectId: 1,
      status: 'blocked',
      createdAt: '2026-05-18T00:00:00Z',
    });
    mockSaveV3SwarmTasks.mockResolvedValue([{ id: 102, projectId: 1, taskId: 'v3-ui-integrator', status: 'blocked' }]);
    mockSaveV3VerifiedFacts.mockResolvedValue([
      { id: 101, projectId: 1, subject: 'Arduino Mega 2560 R3', factType: 'pinout' },
    ]);
  });

  it('renders empty state with "Generate Architecture" button when no nodes', () => {
    renderArchView();
    expect(screen.getByText('Start Building Your Architecture')).toBeDefined();
    expect(screen.getByTestId('button-generate-architecture')).toBeDefined();
  });

  it('"Generate Architecture" button drafts an AI prompt without sending it', () => {
    const eventSpy = vi.fn();
    window.addEventListener(RADIAL_AI_CHAT_DRAFT_EVENT, eventSpy);
    renderArchView();
    const btn = screen.getByTestId('button-generate-architecture');
    fireEvent.click(btn);
    expect(eventSpy).toHaveBeenCalledTimes(1);
    const message = (eventSpy.mock.calls[0]?.[0] as CustomEvent<{ message: string }>).detail.message;
    expect(message).toContain('Generate a complete architecture');
    expect(mockAddMessage).not.toHaveBeenCalled();
    window.removeEventListener(RADIAL_AI_CHAT_DRAFT_EVENT, eventSpy);
  });

  it('drafts targeted radial architecture context into the AI chat bridge', () => {
    mockNodes = [
      { id: 'n1', type: 'custom', position: { x: 10, y: 20 }, data: { label: 'MCU', type: 'mcu' } },
      { id: 'n2', type: 'custom', position: { x: 140, y: 20 }, data: { label: 'Sensor', type: 'sensor' } },
    ];
    mockEdges = [{ id: 'e1', source: 'n1', target: 'n2' }];
    const eventSpy = vi.fn();
    const openSpy = vi.fn();
    window.addEventListener(RADIAL_AI_CHAT_DRAFT_EVENT, eventSpy);
    window.addEventListener('protopulse:open-chat-panel', openSpy);
    renderArchView();

    const detail = dispatchRadial('generate_architecture', {
      view: 'architecture',
      target: 'node',
      targetId: 'n1',
      targetLabel: 'MCU',
      pointer: { x: 320, y: 240 },
    });

    expect(detail.handled).toBe(true);
    expect(openSpy).toHaveBeenCalledTimes(1);
    expect(eventSpy).toHaveBeenCalledTimes(1);
    expect((openSpy.mock.calls[0]?.[0] as CustomEvent<{ designAgent?: boolean }>).detail.designAgent).toBe(false);
    const event = eventSpy.mock.calls[0]?.[0] as CustomEvent<{ message: string }>;
    const message = event.detail.message;
    expect(message).toContain('AI intent: generate.');
    expect(message).toContain('Radial command context');
    expect(message).toContain('Target: node "MCU"');
    expect(message).toContain('Target id: n1');
    expect(message).toContain('Pointer: 320, 240');
    expect(message).toContain('Canvas summary: 2 node(s), 1 connection(s).');
    expect(message).toContain('Target details:');
    expect(message).toContain('MCU [mcu] at x=10, y=20.');
    expect(message).toContain('MCU -> Sensor');
    expect(mockAddMessage).not.toHaveBeenCalled();
    expect(mockAddOutputLog).toHaveBeenCalledWith('[RADIAL] Requested AI architecture generation');
    window.removeEventListener(RADIAL_AI_CHAT_DRAFT_EVENT, eventSpy);
    window.removeEventListener('protopulse:open-chat-panel', openSpy);
  });

  it('renders the ReactFlow canvas and toolbar when nodes exist', () => {
    mockNodes = [{ id: 'n1', type: 'custom', position: { x: 0, y: 0 }, data: { label: 'MCU', type: 'mcu' } }];
    renderArchView();
    expect(screen.getByTestId('react-flow')).toBeDefined();
    expect(screen.getByTestId('tool-select')).toBeDefined();
    expect(screen.getByTestId('tool-pan')).toBeDefined();
    expect(screen.getByTestId('tool-grid')).toBeDefined();
    expect(screen.getByTestId('tool-fit')).toBeDefined();
  });

  it('exposes node metadata for workspace radial targeting', () => {
    mockNodes = [{ id: 'n1', type: 'custom', position: { x: 0, y: 0 }, data: { label: 'MCU', type: 'mcu' } }];
    mockSelectedNodeId = 'n1';
    renderArchView();

    const nodeButton = screen.getByTestId('react-flow').querySelector('button[data-id="n1"]');
    expect(nodeButton).not.toBeNull();
    expect(nodeButton).toHaveAttribute('data-id', 'n1');
    expect(nodeButton).toHaveAttribute('data-node-label', 'MCU');

    const inspector = screen.getByTestId('node-inspector-panel');
    expect(inspector).toHaveAttribute('data-nodeid', 'n1');
    expect(inspector).toHaveAttribute('data-node-label', 'MCU');
    expect(inspector).toHaveAttribute('data-radial-target', 'architecture-node-inspector');
  });

  it('handles radial add_node by placing a new architecture node at the pointer', () => {
    renderArchView();

    const detail = dispatchRadial('add_node', {
      view: 'architecture',
      target: 'canvas',
      pointer: { x: 12, y: 34 },
    });

    expect(detail.handled).toBe(true);
    expect(screen.getByText('New Component')).toBeDefined();
    expect(screen.getByTestId('react-flow')).toHaveAttribute('data-node-count', '1');
    expect(mockPushUndoState).toHaveBeenCalled();
    expect(mockAddOutputLog).toHaveBeenCalledWith('[RADIAL] Added architecture node');
  });

  it('handles radial analysis commands without a toolbar click', () => {
    mockNodes = [{ id: 'n1', type: 'custom', position: { x: 0, y: 0 }, data: { label: 'MCU', type: 'mcu' } }];
    renderArchView();
    expect(screen.queryByTestId('analysis-panel')).toBeNull();

    const detail = dispatchRadial('analyze_architecture', {
      view: 'architecture',
      target: 'node',
      targetId: 'n1',
      targetLabel: 'MCU',
    });

    expect(detail.handled).toBe(true);
    expect(screen.getByTestId('analysis-panel')).toBeDefined();
    expect(mockAddOutputLog).toHaveBeenCalledWith('[RADIAL] Opened architecture analysis');
  });

  it('handles radial validation from the architecture canvas', () => {
    renderArchView();

    const detail = dispatchRadial('run_validation', {
      view: 'architecture',
      target: 'canvas',
    });

    expect(detail.handled).toBe(true);
    expect(mockSetActiveView).toHaveBeenCalledWith('validation');
    expect(mockAddOutputLog).toHaveBeenCalledWith('[ARCH] Navigating to Validation view');
  });

  it('handles radial AI explain against the targeted node', () => {
    mockNodes = [
      { id: 'n1', type: 'custom', position: { x: 10, y: 20 }, data: { label: 'MCU', type: 'mcu' } },
      { id: 'n2', type: 'custom', position: { x: 120, y: 20 }, data: { label: 'Sensor', type: 'sensor' } },
    ];
    mockEdges = [{ id: 'e1', source: 'n1', target: 'n2' }];
    const eventSpy = vi.fn();
    window.addEventListener(RADIAL_AI_CHAT_DRAFT_EVENT, eventSpy);
    renderArchView();

    const detail = dispatchRadial('ai_explain_architecture', {
      view: 'architecture',
      target: 'node',
      targetId: 'n1',
      targetLabel: 'MCU',
    });

    expect(detail.handled).toBe(true);
    expect(eventSpy).toHaveBeenCalledTimes(1);
    const message = (eventSpy.mock.calls[0]?.[0] as CustomEvent<{ message: string }>).detail.message;
    expect(message).toContain('AI intent: explain.');
    expect(message).toContain('Explain this architecture context in plain language.');
    expect(message).toContain('Target: node "MCU"');
    expect(message).toContain('MCU -> Sensor');
    expect(mockAddOutputLog).toHaveBeenCalledWith('[RADIAL] Asked AI to explain architecture target');
    window.removeEventListener(RADIAL_AI_CHAT_DRAFT_EVENT, eventSpy);
  });

  it('handles radial duplicate against the targeted node', () => {
    mockNodes = [{ id: 'n1', type: 'custom', position: { x: 0, y: 0 }, data: { label: 'MCU', type: 'mcu' } }];
    renderArchView();

    const detail = dispatchRadial('duplicate', {
      view: 'architecture',
      target: 'node',
      targetId: 'n1',
      targetLabel: 'MCU',
    });

    expect(detail.handled).toBe(true);
    expect(screen.getByTestId('react-flow')).toHaveAttribute('data-node-count', '2');
    expect(mockAddOutputLog).toHaveBeenCalledWith('[RADIAL] Duplicated node n1');
  });

  it('handles radial add_to_bom with the targeted node label', () => {
    mockNodes = [{ id: 'n1', type: 'custom', position: { x: 0, y: 0 }, data: { label: 'MCU', type: 'mcu' } }];
    renderArchView();

    const detail = dispatchRadial('add_to_bom', {
      view: 'architecture',
      target: 'node',
      targetId: 'n1',
      targetLabel: 'MCU',
    });

    expect(detail.handled).toBe(true);
    expect(mockAddBomItem).toHaveBeenCalledWith(
      expect.objectContaining({
        partNumber: 'MCU',
        description: 'Architecture block: MCU',
        quantity: 1,
      }),
    );
    expect(mockAddOutputLog).toHaveBeenCalledWith('[RADIAL] Added MCU to BOM');
  });

  it('provides an undo callback for radial node deletion', () => {
    mockNodes = [
      { id: 'n1', type: 'custom', position: { x: 0, y: 0 }, data: { label: 'MCU', type: 'mcu' } },
      { id: 'n2', type: 'custom', position: { x: 120, y: 0 }, data: { label: 'Sensor', type: 'sensor' } },
    ];
    mockEdges = [{ id: 'e1', source: 'n1', target: 'n2' }];
    renderArchView();

    const detail = dispatchRadial('delete', {
      view: 'architecture',
      target: 'node',
      targetId: 'n1',
      targetLabel: 'MCU',
    });

    expect(detail.handled).toBe(true);
    expect(detail.undo?.label).toBe('Restore MCU');
    expect(detail.undo?.description).toContain('1 connected edge');
    expect(screen.getByTestId('react-flow')).toHaveAttribute('data-node-count', '1');
    expect(screen.queryByTestId('edge-color-legend')).toBeNull();

    act(() => {
      detail.undo?.run();
    });

    expect(screen.getByTestId('react-flow')).toHaveAttribute('data-node-count', '2');
    expect(screen.getByTestId('edge-color-legend')).toBeDefined();
    expect(mockSetSelectedNodeId).toHaveBeenLastCalledWith('n1');
    expect(mockAddOutputLog).toHaveBeenCalledWith('[RADIAL] Restored deleted node n1');
  });

  it('renders the registry-backed linear context menu fallback', () => {
    renderArchView();

    expect(screen.getByTestId('ctx-command-add_sensor')).toHaveTextContent('Add Sensor');
    expect(screen.getByTestId('ctx-command-toggle_grid')).toHaveTextContent('Toggle Grid');
    expect(screen.getByTestId('ctx-command-copy_json')).toHaveTextContent('Copy JSON');
    expect(screen.getByTestId('ctx-command-create_schematic_instance')).toHaveTextContent('Create Schematic');
  });

  it('keeps node-only linear commands disabled until an architecture block is selected', () => {
    renderArchView();

    expect(screen.getByTestId('ctx-command-edit_component')).toBeDisabled();
    expect(screen.getByTestId('ctx-command-edit_component')).toHaveAttribute(
      'title',
      'Select an Architecture block first.',
    );
    expect(screen.getByTestId('ctx-command-create_schematic_instance')).toBeDisabled();
    expect(screen.getByTestId('ctx-command-create_schematic_instance')).toHaveAttribute(
      'title',
      'Select an Architecture block first.',
    );
  });

  it('handles linear quick-add commands through the shared action registry', () => {
    renderArchView();

    fireEvent.click(screen.getByTestId('ctx-command-add_sensor'));

    expect(screen.getByText('Sensor')).toBeDefined();
    expect(screen.getByTestId('react-flow')).toHaveAttribute('data-node-count', '1');
    expect(mockPushUndoState).toHaveBeenCalled();
  });

  it('handles linear analysis commands without duplicating the action list', () => {
    mockNodes = [{ id: 'n1', type: 'custom', position: { x: 0, y: 0 }, data: { label: 'MCU', type: 'mcu' } }];
    renderArchView();
    expect(screen.queryByTestId('analysis-panel')).toBeNull();

    fireEvent.click(screen.getByTestId('ctx-command-analyze_architecture'));

    expect(screen.getByTestId('analysis-panel')).toBeDefined();
    expect(mockAddOutputLog).toHaveBeenCalledWith('[ARCH] Opened architecture analysis from context menu');
  });

  it('handles linear AI expand commands with the selected architecture block', () => {
    mockSelectedNodeId = 'n1';
    mockNodes = [{ id: 'n1', type: 'custom', position: { x: 0, y: 0 }, data: { label: 'MCU', type: 'mcu' } }];
    const eventSpy = vi.fn();
    window.addEventListener(RADIAL_AI_CHAT_DRAFT_EVENT, eventSpy);
    renderArchView();

    fireEvent.click(screen.getByTestId('ctx-command-ai_expand_block'));

    expect(eventSpy).toHaveBeenCalledTimes(1);
    const message = (eventSpy.mock.calls[0]?.[0] as CustomEvent<{ message: string }>).detail.message;
    expect(message).toContain('AI intent: expand_block.');
    expect(message).toContain('Expand this architecture block into concrete sub-blocks.');
    expect(message).toContain('Target: node "MCU"');
    expect(mockAddOutputLog).toHaveBeenCalledWith('[ARCH] Asked AI to expand architecture context');
    window.removeEventListener(RADIAL_AI_CHAT_DRAFT_EVENT, eventSpy);
  });

  it('enables selected-node linear commands and routes edit to the Component Editor', () => {
    mockSelectedNodeId = 'n1';
    mockNodes = [
      {
        id: 'n1',
        type: 'custom',
        position: { x: 0, y: 0 },
        data: { label: 'MCU', type: 'mcu', componentPartId: 42 },
      },
    ];
    renderArchView();

    const editCommand = screen.getByTestId('ctx-command-edit_component');
    expect(editCommand).not.toBeDisabled();
    fireEvent.click(editCommand);

    expect(mockSetPendingComponentPartId).toHaveBeenCalledWith(42);
    expect(mockSetActiveView).toHaveBeenCalledWith('component_editor');
    expect(mockAddOutputLog).toHaveBeenCalledWith('[ARCH] Opening Component Editor for node n1');
  });

  it('shows and hides the live v3 architecture gate from the toolbar', () => {
    mockNodes = [{ id: 'n1', type: 'custom', position: { x: 0, y: 0 }, data: { label: 'MCU', type: 'mcu' } }];
    renderArchView();

    const v3Panel = screen.getByTestId('v3-architecture-readiness-panel');
    expect(v3Panel).toHaveTextContent('v3 Architecture Gate');
    expect(v3Panel).toHaveTextContent('Metadata rules');
    expect(v3Panel).toHaveTextContent('firmware');
    expect(v3Panel).toHaveClass('z-40');
    expect(v3Panel).toHaveClass('md:left-[432px]');
    expect(v3Panel).toHaveClass('md:right-auto');
    expect(v3Panel).toHaveClass('md:top-[4.25rem]');
    expect(v3Panel).toHaveClass('resize');
    expect(v3Panel).toHaveClass('overflow-hidden');
    expect(screen.getByTestId('v3-boundary-objects')).toHaveTextContent('Boundary objects');
    expect(screen.getByTestId('v3-boundary-objects')).toHaveTextContent('hardware: MCU');
    expect(v3Panel).toHaveTextContent('hardware: satisfied');
    expect(v3Panel).toHaveTextContent('firmware: missing');
    expect(v3Panel).toHaveTextContent('mechanical: missing');
    expect(screen.getByTestId('v3-migration-plan')).toHaveTextContent('Migration plan');
    expect(screen.getByTestId('v3-migration-plan')).toHaveTextContent('xyflow to tldraw-boundaries');
    expect(screen.getByTestId('v3-migration-plan')).toHaveTextContent('Capture live graph');
    expect(screen.getByTestId('v3-migration-plan')).toHaveTextContent('Feature-flag launch');
    expect(screen.getByTestId('v3-live-adoption-status')).toHaveTextContent('Live app adoption');
    expect(screen.getByTestId('v3-live-adoption-status')).toHaveTextContent('xyflow');
    expect(screen.getByTestId('v3-live-adoption-status')).toHaveTextContent('reference');
    expect(screen.getByTestId('v3-launch-checklist')).toHaveTextContent('Launch checklist');
    expect(screen.getByTestId('v3-launch-checklist')).toHaveTextContent('Compile proof');
    expect(screen.getByTestId('v3-launch-checklist')).toHaveTextContent('Tyler UI verification');
    expect(screen.getByTestId('v3-launch-checklist')).toHaveTextContent('pending');
    expect(screen.getByTestId('v3-verified-source-facts')).toHaveTextContent('Verified sources');
    expect(screen.getByTestId('v3-verified-source-facts')).toHaveTextContent(
      'No verified board-pack facts matched yet',
    );
    expect(screen.getByTestId('v3-compile-report')).toHaveTextContent('Live tscircuit compile');
    expect(screen.getByTestId('v3-compile-report')).toHaveTextContent('blocked');
    expect(screen.getByTestId('v3-execution-readiness')).toHaveTextContent('Execution swarm');
    expect(screen.getByTestId('v3-execution-readiness')).toHaveTextContent('Task storage');
    expect(screen.getByTestId('v3-execution-readiness')).toHaveTextContent('ui-integrator');
    expect(screen.getByTestId('v3-execution-readiness')).toHaveTextContent(
      'compile report must be ready before swarm dispatch',
    );

    fireEvent.click(screen.getByTestId('asset-manager-close'));
    expect(v3Panel).toHaveClass('md:right-3');
    expect(v3Panel).toHaveClass('md:bottom-16');
    expect(v3Panel).toHaveClass('md:max-h-[calc(100%-5rem)]');

    const collapseBtn = screen.getByTestId('v3-architecture-gate-collapse');
    expect(collapseBtn).toHaveAttribute('aria-label', 'Collapse v3 architecture gate');
    expect(collapseBtn).toHaveAttribute('aria-expanded', 'true');

    fireEvent.click(collapseBtn);
    expect(v3Panel).toHaveAttribute('data-collapsed', 'true');
    expect(v3Panel).toHaveClass('min-h-0');
    expect(v3Panel).toHaveClass('resize-none');
    expect(collapseBtn).toHaveAttribute('aria-label', 'Expand v3 architecture gate');
    expect(collapseBtn).toHaveAttribute('aria-expanded', 'false');
    expect(screen.getByTestId('v3-architecture-gate-summary')).toHaveTextContent('blocked');
    expect(screen.getByTestId('v3-architecture-gate-summary')).toHaveTextContent('1 nodes');
    expect(screen.queryByTestId('v3-boundary-objects')).toBeNull();

    fireEvent.click(collapseBtn);
    expect(v3Panel).toHaveAttribute('data-collapsed', 'false');
    expect(collapseBtn).toHaveAttribute('aria-label', 'Collapse v3 architecture gate');
    expect(collapseBtn).toHaveAttribute('aria-expanded', 'true');
    expect(screen.getByTestId('v3-boundary-objects')).toHaveTextContent('Boundary objects');

    const gateBtn = screen.getByTestId('tool-v3-architecture-gate');
    expect(gateBtn).toHaveAttribute('aria-label', 'Hide v3 architecture gate');

    fireEvent.click(gateBtn);
    expect(screen.queryByTestId('v3-architecture-readiness-panel')).toBeNull();
    expect(gateBtn).toHaveAttribute('aria-label', 'Show v3 architecture gate');
  });

  it('saves the current v3 compile run from the readiness panel', async () => {
    mockNodes = [{ id: 'n1', type: 'custom', position: { x: 0, y: 0 }, data: { label: 'MCU', type: 'mcu' } }];
    renderArchView();

    fireEvent.click(screen.getByTestId('v3-save-compile-run'));

    expect(await screen.findByText('Compile run saved')).toBeDefined();
    expect(mockSaveV3CompileRun).toHaveBeenCalledWith(1, expect.objectContaining({ status: 'blocked' }));
    expect(mockAddOutputLog).toHaveBeenCalledWith('[ARCH:v3] Saved compile run #99 (blocked)');
  });

  it('saves resolved verified facts from the readiness panel', async () => {
    mockNodes = [
      {
        id: 'mega',
        type: 'custom',
        position: { x: 0, y: 0 },
        data: { label: 'Arduino Mega 2560 R3', type: 'hardware' },
      },
    ];
    renderArchView();

    expect(screen.getByTestId('v3-verified-source-facts')).toHaveTextContent('Arduino Mega 2560 R3: pinout');
    fireEvent.click(screen.getByTestId('v3-save-verified-facts'));

    expect(await screen.findByText('Verified facts saved')).toBeDefined();
    expect(mockSaveV3VerifiedFacts).toHaveBeenCalledWith(1, [
      expect.objectContaining({
        subject: 'Arduino Mega 2560 R3',
        factType: 'pinout',
        sourceRef: 'shared/verified-boards/arduino-mega-2560-r3',
      }),
    ]);
    expect(mockAddOutputLog).toHaveBeenCalledWith('[ARCH:v3] Saved 1 verified facts');
  });

  it('saves v3 swarm tasks from the readiness panel', async () => {
    mockNodes = [{ id: 'n1', type: 'custom', position: { x: 0, y: 0 }, data: { label: 'MCU', type: 'mcu' } }];
    renderArchView();

    fireEvent.click(screen.getByTestId('v3-save-swarm-tasks'));

    expect(await screen.findByText('Swarm tasks saved')).toBeDefined();
    expect(mockSaveV3SwarmTasks).toHaveBeenCalledWith(
      1,
      expect.objectContaining({
        status: 'blocked',
        summary: expect.objectContaining({ workers: 3 }),
      }),
    );
    expect(mockAddOutputLog).toHaveBeenCalledWith('[ARCH:v3] Saved 1 swarm tasks (blocked)');
  });

  it('shows generating overlay when isGenerating is true', () => {
    mockIsGenerating = true;
    renderArchView();
    expect(screen.getByText('GENERATING ARCHITECTURE...')).toBeDefined();
  });

  it('tool-fit button is clickable', () => {
    mockNodes = [{ id: 'n1', type: 'custom', position: { x: 0, y: 0 }, data: { label: 'MCU', type: 'mcu' } }];
    renderArchView();
    const fitBtn = screen.getByTestId('tool-fit');
    expect(() => fireEvent.click(fitBtn)).not.toThrow();
  });

  it('asset manager toggle button works', () => {
    mockNodes = [{ id: 'n1', type: 'custom', position: { x: 0, y: 0 }, data: { label: 'MCU', type: 'mcu' } }];
    renderArchView();
    // Asset manager visible by default
    expect(screen.getByTestId('asset-manager')).toBeDefined();
    // Toggle off
    const toggleBtn = screen.getByTestId('toggle-asset-manager');
    fireEvent.click(toggleBtn);
    expect(screen.queryByTestId('asset-manager')).toBeNull();
    // Toggle back on
    fireEvent.click(toggleBtn);
    expect(screen.getByTestId('asset-manager')).toBeDefined();
  });

  it('shows edge color legend when edges exist', () => {
    mockNodes = [
      { id: 'n1', type: 'custom', position: { x: 0, y: 0 }, data: { label: 'A', type: 'mcu' } },
      { id: 'n2', type: 'custom', position: { x: 100, y: 0 }, data: { label: 'B', type: 'sensor' } },
    ];
    mockEdges = [{ id: 'e1', source: 'n1', target: 'n2' }];
    renderArchView();
    const legend = screen.getByTestId('edge-color-legend');
    expect(legend).toBeDefined();
    // Scope text queries to the legend element to avoid collisions with
    // context menu items (e.g. "Power" also appears in Add Component submenu).
    const { getByText } = within(legend);
    expect(getByText('Data / Signal')).toBeDefined();
    expect(getByText('Power')).toBeDefined();
    expect(getByText('Control')).toBeDefined();
  });

  it('hides edge color legend when no edges', () => {
    mockNodes = [{ id: 'n1', type: 'custom', position: { x: 0, y: 0 }, data: { label: 'A', type: 'mcu' } }];
    renderArchView();
    expect(screen.queryByTestId('edge-color-legend')).toBeNull();
  });

  // E2E-078 — tool-analyze button was reported "dead / does nothing on click"
  // during the 2026-04-18 walkthrough. Handler is correctly wired; this
  // regression asserts clicking the toolbar button toggles the analysis
  // slide-over panel on and off.
  it('tool-analyze button toggles the analysis panel (E2E-078)', () => {
    mockNodes = [{ id: 'n1', type: 'custom', position: { x: 0, y: 0 }, data: { label: 'MCU', type: 'mcu' } }];
    renderArchView();

    // Panel hidden by default.
    expect(screen.queryByTestId('analysis-panel')).toBeNull();

    // First click opens the panel + runs analysis.
    const analyzeBtn = screen.getByTestId('tool-analyze');
    fireEvent.click(analyzeBtn);
    const panel = screen.getByTestId('analysis-panel');
    expect(panel).toBeDefined();
    expect(screen.getByTestId('analysis-panel-title')).toBeDefined();

    // Second click closes the panel.
    fireEvent.click(analyzeBtn);
    expect(screen.queryByTestId('analysis-panel')).toBeNull();
  });

  // E2E-078 — even on an empty design (no components), clicking tool-analyze
  // should surface the panel (showing the empty-design sentinel / loading
  // state). Guards against a regression where the click appears dead on
  // fresh projects where the EmptyState overlay covers most of the canvas.
  it('tool-analyze opens the panel even on an empty design (E2E-078)', () => {
    renderArchView(); // mockNodes = [] from beforeEach
    // The empty-project overlay lives at z-0 with pointer-events-none on the
    // outer wrapper; the toolbar sits at z-10 and the analysis panel at z-20
    // so both remain clickable/visible even on a fresh project.
    const analyzeBtn = screen.getByTestId('tool-analyze');
    fireEvent.click(analyzeBtn);
    expect(screen.getByTestId('analysis-panel')).toBeDefined();
    // Panel header renders immediately (content is async via setTimeout(0)).
    expect(screen.getByTestId('analysis-panel-title')).toBeDefined();
  });
});
