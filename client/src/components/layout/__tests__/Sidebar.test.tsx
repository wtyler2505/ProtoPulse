import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import React from 'react';

// -------------------------------------------------------------------
// Mocks
// -------------------------------------------------------------------

const mockSetActiveView = vi.fn();
const mockSetProjectName = vi.fn();
const mockSetProjectDescription = vi.fn();
const mockSetNodes = vi.fn();
const mockFocusNode = vi.fn();
const mockAddOutputLog = vi.fn();

let mockNodes: Array<{
  id: string;
  type?: string;
  position: { x: number; y: number };
  data: Record<string, unknown>;
}> = [];

vi.mock('@/lib/contexts/project-meta-context', () => ({
  useProjectMeta: () => ({
    activeView: 'architecture',
    setActiveView: mockSetActiveView,
    projectName: 'TestProject',
    projectDescription: 'A test project',
    setProjectName: mockSetProjectName,
    setProjectDescription: mockSetProjectDescription,
  }),
}));

vi.mock('@/lib/contexts/architecture-context', () => ({
  useArchitecture: () => ({
    nodes: mockNodes,
    edges: [],
    setNodes: mockSetNodes,
    selectedNodeId: null,
    focusNode: mockFocusNode,
  }),
}));

vi.mock('@/lib/contexts/bom-context', () => ({
  useBom: () => ({ bom: [] }),
}));

vi.mock('@/lib/contexts/validation-context', () => ({
  useValidation: () => ({ issues: [] }),
}));

vi.mock('@/lib/contexts/history-context', () => ({
  useHistory: () => ({
    history: [],
  }),
}));

vi.mock('@/lib/contexts/output-context', () => ({
  useOutput: () => ({
    addOutputLog: mockAddOutputLog,
  }),
}));

vi.mock('@/lib/contexts/project-id-context', () => ({
  useProjectId: () => 1,
}));

vi.mock('@/lib/auth-context', () => ({
  useAuth: () => ({
    user: { id: 1, username: 'testuser' },
    sessionId: 'test-session',
    loading: false,
    login: vi.fn(),
    register: vi.fn(),
    logout: vi.fn(),
  }),
}));

vi.mock('@/components/ui/styled-tooltip', () => ({
  StyledTooltip: ({ children }: { children: React.ReactNode }) => <>{children}</>,
}));

vi.mock('@/components/ui/context-menu', () => ({
  ContextMenu: ({ children }: { children: React.ReactNode }) => <>{children}</>,
  ContextMenuTrigger: ({ children }: { children: React.ReactNode }) => <>{children}</>,
  ContextMenuContent: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  ContextMenuItem: ({ children, onSelect }: { children: React.ReactNode; onSelect?: () => void }) => (
    <button onClick={onSelect}>{children}</button>
  ),
}));

// -------------------------------------------------------------------
// Import & helpers
// -------------------------------------------------------------------

import Sidebar from '@/components/layout/Sidebar';

function createTestQueryClient() {
  return new QueryClient({
    defaultOptions: {
      queries: { retry: false, gcTime: 0 },
      mutations: { retry: false },
    },
  });
}

function renderSidebar(props: Partial<React.ComponentProps<typeof Sidebar>> = {}) {
  const qc = createTestQueryClient();
  const defaultProps = {
    isOpen: true,
    onClose: vi.fn(),
    collapsed: false,
    width: 256,
    onToggleCollapse: vi.fn(),
  };
  return render(
    <QueryClientProvider client={qc}>
      <Sidebar {...defaultProps} {...props} />
    </QueryClientProvider>,
  );
}

// -------------------------------------------------------------------
// Tests
// -------------------------------------------------------------------

describe('Sidebar', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockNodes = [];
  });

  it('renders collapsed state with nav icon buttons', () => {
    const onToggle = vi.fn();
    renderSidebar({ collapsed: true, onToggleCollapse: onToggle });
    expect(screen.getByTestId('sidebar-collapsed')).toBeDefined();
    // Architecture icon should be present
    expect(screen.getByTestId('sidebar-icon-architecture')).toBeDefined();
  });

  it('collapsed nav icon changes active view on click', () => {
    renderSidebar({ collapsed: true });
    const procurementBtn = screen.getByTestId('sidebar-icon-procurement');
    fireEvent.click(procurementBtn);
    expect(mockSetActiveView).toHaveBeenCalledWith('procurement');
  });

  it('clicking collapsed sidebar calls onToggleCollapse', () => {
    const onToggle = vi.fn();
    renderSidebar({ collapsed: true, onToggleCollapse: onToggle });
    const collapsedBar = screen.getByTestId('sidebar-collapsed');
    fireEvent.click(collapsedBar);
    expect(onToggle).toHaveBeenCalledTimes(1);
  });

  it('renders expanded sidebar with project name and search', () => {
    renderSidebar();
    expect(screen.getByText('TestProject')).toBeDefined();
    expect(screen.getByTestId('sidebar-search')).toBeDefined();
    expect(screen.getByText('Project Explorer')).toBeDefined();
  });

  it('search input filters blocks (shows "No results" for non-matching query)', () => {
    mockNodes = [
      { id: 'n1', type: 'custom', position: { x: 0, y: 0 }, data: { label: 'ESP32', type: 'mcu' } },
    ];
    renderSidebar();
    const search = screen.getByTestId('sidebar-search');
    fireEvent.change(search, { target: { value: 'nonexistent' } });
    expect(screen.getByText('No results')).toBeDefined();
  });

  it('search input with matching query shows the node', () => {
    mockNodes = [
      { id: 'n1', type: 'custom', position: { x: 0, y: 0 }, data: { label: 'ESP32', type: 'mcu' } },
    ];
    renderSidebar();
    const search = screen.getByTestId('sidebar-search');
    fireEvent.change(search, { target: { value: 'ESP' } });
    expect(screen.getByText('ESP32')).toBeDefined();
  });

  it('clicking a node in the component tree calls focusNode', () => {
    mockNodes = [
      { id: 'node-abc', type: 'custom', position: { x: 0, y: 0 }, data: { label: 'SHT40', type: 'sensor' } },
    ];
    renderSidebar();
    const nodeItem = screen.getByTestId('block-node-node-abc');
    fireEvent.click(nodeItem);
    expect(mockFocusNode).toHaveBeenCalledWith('node-abc');
  });

  it('displays block count badge', () => {
    mockNodes = [
      { id: 'n1', type: 'custom', position: { x: 0, y: 0 }, data: { label: 'MCU', type: 'mcu' } },
      { id: 'n2', type: 'custom', position: { x: 0, y: 0 }, data: { label: 'Sensor', type: 'sensor' } },
    ];
    renderSidebar();
    // The architecture section badge shows node count "2"
    const badge = screen.getByTestId('explorer-badge-architecture');
    expect(badge.textContent).toBe('2');
  });

  it('mobile backdrop calls onClose when clicked', () => {
    const onClose = vi.fn();
    renderSidebar({ onClose });
    const backdrop = screen.getByTestId('sidebar-backdrop');
    fireEvent.click(backdrop);
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('toggling Architecture section hides/shows component tree', () => {
    mockNodes = [
      { id: 'n1', type: 'custom', position: { x: 0, y: 0 }, data: { label: 'ESP32', type: 'mcu' } },
    ];
    renderSidebar();
    // Initially expanded — node visible
    expect(screen.getByText('ESP32')).toBeDefined();
    // Click the Architecture section toggle
    const archToggle = screen.getByTestId('explorer-section-architecture');
    fireEvent.click(archToggle);
    // Node should no longer be visible
    expect(screen.queryByText('ESP32')).toBeNull();
  });
});
