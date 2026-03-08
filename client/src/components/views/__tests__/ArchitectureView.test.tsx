import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, within } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import React from 'react';

// -------------------------------------------------------------------
// Mocks
// -------------------------------------------------------------------

const mockSetNodes = vi.fn();
const mockSetEdges = vi.fn();
const mockPushUndoState = vi.fn();
const mockUndo = vi.fn();
const mockRedo = vi.fn();
const mockSetSelectedNodeId = vi.fn();
const mockSetPendingComponentPartId = vi.fn();
const mockAddMessage = vi.fn();
const mockSetIsGenerating = vi.fn();
const mockAddOutputLog = vi.fn();
const mockSetActiveView = vi.fn();

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
    addBomItem: vi.fn(),
    deleteBomItem: vi.fn(),
    updateBomItem: vi.fn(),
  }),
}));

vi.mock('@/lib/clipboard', () => ({
  copyToClipboard: vi.fn(),
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
  ContextMenuContent: ({ children }: { children: React.ReactNode }) => <div data-testid="context-menu-content">{children}</div>,
  ContextMenuItem: ({
    children,
    onSelect,
    ...props
  }: { children: React.ReactNode; onSelect?: () => void } & Record<string, unknown>) => (
    <button onClick={onSelect} {...props}>{children}</button>
  ),
  ContextMenuSeparator: () => <hr />,
  ContextMenuSub: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  ContextMenuSubTrigger: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  ContextMenuSubContent: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
}));

// Mock AssetManager
vi.mock('@/components/panels/AssetManager', () => ({
  default: ({ onClose }: { onClose?: () => void }) => (
    <div data-testid="asset-manager">
      <button data-testid="asset-manager-close" onClick={onClose}>Close</button>
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

// Mock the xyflow CSS import so PostCSS/Tailwind v4 doesn't choke on it
vi.mock('@xyflow/react/dist/style.css', () => ({}));

// Mock @xyflow/react — the component wraps ArchitectureFlow in ReactFlowProvider
const mockFitView = vi.fn();
const mockScreenToFlowPosition = vi.fn().mockReturnValue({ x: 100, y: 100 });
const mockSetCenter = vi.fn();

vi.mock('@xyflow/react', () => ({
  ReactFlow: ({ children, nodes, edges }: { children?: React.ReactNode; nodes: unknown[]; edges: unknown[] }) => (
    <div data-testid="react-flow" data-node-count={nodes.length} data-edge-count={edges.length}>
      {children}
    </div>
  ),
  ReactFlowProvider: ({ children }: { children: React.ReactNode }) => <>{children}</>,
  useReactFlow: () => ({
    fitView: mockFitView,
    screenToFlowPosition: mockScreenToFlowPosition,
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

function createTestQueryClient() {
  return new QueryClient({
    defaultOptions: {
      queries: { retry: false, gcTime: 0 },
      mutations: { retry: false },
    },
  });
}

function renderArchView() {
  const qc = createTestQueryClient();
  return render(
    <QueryClientProvider client={qc}>
      <ArchitectureView />
    </QueryClientProvider>,
  );
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
  });

  it('renders empty state with "Generate Architecture" button when no nodes', () => {
    renderArchView();
    expect(screen.getByText('Start Building Your Architecture')).toBeDefined();
    expect(screen.getByTestId('button-generate-architecture')).toBeDefined();
  });

  it('"Generate Architecture" button adds a user message and dispatches chat-send event', () => {
    const eventSpy = vi.fn();
    window.addEventListener('protopulse:chat-send', eventSpy);
    renderArchView();
    const btn = screen.getByTestId('button-generate-architecture');
    fireEvent.click(btn);
    expect(mockAddMessage).toHaveBeenCalledWith(
      expect.objectContaining({ role: 'user', content: expect.stringContaining('Generate a complete architecture') as string }),
    );
    expect(eventSpy).toHaveBeenCalledTimes(1);
    window.removeEventListener('protopulse:chat-send', eventSpy);
  });

  it('renders the ReactFlow canvas and toolbar when nodes exist', () => {
    mockNodes = [
      { id: 'n1', type: 'custom', position: { x: 0, y: 0 }, data: { label: 'MCU', type: 'mcu' } },
    ];
    renderArchView();
    expect(screen.getByTestId('react-flow')).toBeDefined();
    expect(screen.getByTestId('tool-select')).toBeDefined();
    expect(screen.getByTestId('tool-pan')).toBeDefined();
    expect(screen.getByTestId('tool-grid')).toBeDefined();
    expect(screen.getByTestId('tool-fit')).toBeDefined();
  });

  it('shows generating overlay when isGenerating is true', () => {
    mockIsGenerating = true;
    renderArchView();
    expect(screen.getByText('GENERATING ARCHITECTURE...')).toBeDefined();
  });

  it('tool-fit button calls fitView on click', () => {
    mockNodes = [
      { id: 'n1', type: 'custom', position: { x: 0, y: 0 }, data: { label: 'MCU', type: 'mcu' } },
    ];
    renderArchView();
    const fitBtn = screen.getByTestId('tool-fit');
    fireEvent.click(fitBtn);
    expect(mockFitView).toHaveBeenCalledWith({ padding: 0.2 });
  });

  it('asset manager toggle button works', () => {
    mockNodes = [
      { id: 'n1', type: 'custom', position: { x: 0, y: 0 }, data: { label: 'MCU', type: 'mcu' } },
    ];
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
    mockNodes = [
      { id: 'n1', type: 'custom', position: { x: 0, y: 0 }, data: { label: 'A', type: 'mcu' } },
    ];
    renderArchView();
    expect(screen.queryByTestId('edge-color-legend')).toBeNull();
  });
});
