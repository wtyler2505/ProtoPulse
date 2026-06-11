import { beforeEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { WorkspaceHeader } from '@/pages/workspace/WorkspaceHeader';
import { BeginnerMode } from '@/lib/beginner-mode';
import { RolePresetManager } from '@/lib/role-presets';
import type { WorkspaceState } from '@/pages/workspace/workspace-reducer';
import type { ViewMode } from '@/lib/project-context';

const mockUseProjectHealth = vi.fn();
const mockUseHardwareWorkspaceStatus = vi.fn();

vi.mock('@/components/ui/theme-toggle', () => ({
  default: () => <div data-testid="theme-toggle" />,
}));

vi.mock('@/components/ui/styled-tooltip', () => ({
  StyledTooltip: ({ children }: { children: React.ReactNode }) => <>{children}</>,
}));

vi.mock('@/hooks/use-toast', () => ({
  useToast: () => ({
    toast: vi.fn(),
  }),
}));

vi.mock('@/lib/project-health', () => ({
  useProjectHealth: (...args: unknown[]) => mockUseProjectHealth(...args),
  getProjectHealthToneClasses: () => 'tone-class',
}));

vi.mock('@/lib/hardware-workspace-status', () => ({
  useHardwareWorkspaceStatus: (...args: unknown[]) => mockUseHardwareWorkspaceStatus(...args),
  getHardwareWorkspaceToneClasses: () => 'hardware-tone-class',
  getHardwareWorkspaceFactClasses: () => 'hardware-fact-class',
}));

vi.mock('@/lib/contexts/project-meta-context', () => ({
  useProjectMeta: () => ({
    projectName: 'ProtoPulse Test Project',
  }),
}));

vi.mock('@/lib/contexts/project-id-context', () => ({
  useProjectId: () => 7,
}));

vi.mock('@/lib/contexts/architecture-context', () => ({
  useArchitecture: () => ({
    nodes: [],
    edges: [],
    setNodes: vi.fn(),
    setEdges: vi.fn(),
    pushUndoState: vi.fn(),
  }),
}));

vi.mock('@/lib/contexts/bom-context', () => ({
  useBom: () => ({
    bom: [],
    addBomItem: vi.fn(),
  }),
}));

vi.mock('@/lib/contexts/validation-context', () => ({
  useValidation: () => ({
    issues: [],
  }),
}));

vi.mock('@/pages/workspace/lazy-imports', () => ({
  TutorialMenu: () => <div data-testid="tutorial-menu" />,
  ExplainPanelButton: () => <button data-testid="explain-panel-button" type="button">Explain</button>,
  WhatsNewPanel: () => <div data-testid="whats-new-panel" />,
  MentionBadge: () => <div data-testid="mention-badge" />,
  ShareProjectButton: () => <button data-testid="share-project-button" type="button">Share</button>,
}));

function buildWorkspaceState(overrides: Partial<WorkspaceState> = {}): WorkspaceState {
  return {
    sidebarOpen: false,
    chatOpen: false,
    sidebarCollapsed: false,
    chatCollapsed: false,
    sidebarWidth: 320,
    chatWidth: 420,
    shortcutsOpen: false,
    moreMenuOpen: false,
    activityFeedOpen: false,
    pcbTutorialOpen: false,
    predictionPanelOpen: false,
    ...overrides,
  };
}

describe('WorkspaceHeader', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    localStorage.clear();
    BeginnerMode.resetInstance();
    RolePresetManager.resetInstance();
    mockUseProjectHealth.mockReturnValue({
      actionLabel: 'Review snapshots',
      badgeLabel: 'Saved + restore',
      detail: 'Saved restore points are available in Design History if you need to roll back a major change.',
      facts: [
        { id: 'restore', label: '2 restore points', tone: 'positive' },
      ],
      isSaving: false,
      lastSavedAt: null,
      manufacturingCheckpointCount: 0,
      restorePointCount: 2,
      restoreStatus: 'ready',
      summary: 'Saved with 2 restore points',
      tone: 'recovery',
    });
    mockUseHardwareWorkspaceStatus.mockReturnValue({
      actionLabel: 'Open Arduino workspace',
      actionView: 'arduino',
      badgeLabel: 'Hardware ready',
      detail: 'A board profile and upload port are configured for hardware work.',
      facts: [
        { id: 'profile', label: 'Workbench Uno', tone: 'positive' },
      ],
      summary: 'Hardware bench is configured',
      tone: 'ready',
    });
  });

  it('keeps status and workspace mode inside More while preserving navigation actions', () => {
    const setActiveView = vi.fn();
    const queryClient = new QueryClient({
      defaultOptions: {
        queries: { retry: false, gcTime: 0 },
        mutations: { retry: false },
      },
    });

    render(
      <QueryClientProvider client={queryClient}>
        <WorkspaceHeader
          ws={buildWorkspaceState()}
          dispatch={vi.fn()}
          activeView={'architecture' as ViewMode}
          setActiveView={setActiveView}
        />
      </QueryClientProvider>,
    );

    expect(screen.queryByTestId('workspace-health-badge')).not.toBeInTheDocument();
    expect(screen.queryByTestId('workspace-hardware-badge')).not.toBeInTheDocument();
    expect(screen.queryByTestId('workspace-mode-button')).not.toBeInTheDocument();
    expect(screen.queryByTestId('coach-help-button')).not.toBeInTheDocument();

    fireEvent.click(screen.getByTestId('workspace-more-button'));
    expect(screen.getByTestId('more-status-hardware')).toHaveTextContent('Hardware');
    expect(screen.getByTestId('more-status-health')).toHaveTextContent('Project health');
    expect(screen.getByTestId('workspace-mode-button')).toHaveTextContent('Hobbyist');
    expect(screen.getByTestId('coach-help-button')).toHaveTextContent('Coach & Help');

    fireEvent.click(screen.getByTestId('more-status-hardware'));
    expect(setActiveView).toHaveBeenCalledWith('arduino');

    fireEvent.click(screen.getByTestId('more-status-health'));
    expect(setActiveView).toHaveBeenCalledWith('design_history');
  });

  // E2E-075 / Plan 03 Phase 2: icon-only header buttons must have aria-label
  // so screen-reader users have an accessible name. Each button renders only a
  // lucide icon with no visible text — aria-label is the accessible name.
  it('icon-only header buttons expose aria-labels (E2E-075)', () => {
    const queryClient = new QueryClient({
      defaultOptions: {
        queries: { retry: false, gcTime: 0 },
        mutations: { retry: false },
      },
    });

    render(
      <QueryClientProvider client={queryClient}>
        <WorkspaceHeader
          ws={buildWorkspaceState()}
          dispatch={vi.fn()}
          activeView={'architecture' as ViewMode}
          setActiveView={vi.fn()}
        />
      </QueryClientProvider>,
    );

    fireEvent.click(screen.getByTestId('workspace-more-button'));

    const pcbTutorialBtn = screen.getByTestId('pcb-tutorial-button');
    expect(pcbTutorialBtn.getAttribute('aria-label')).toBeTruthy();
    expect(pcbTutorialBtn).toHaveAccessibleName('PCB Tutorial');

    const activityFeedBtn = screen.getByTestId('toggle-activity-feed');
    expect(activityFeedBtn.getAttribute('aria-label')).toBeTruthy();
    expect(activityFeedBtn).toHaveAccessibleName('Activity feed');
  });

  // Frontend pivot: collapse the former stacked 80px header into one calmer
  // 48px command bar. Secondary actions and secondary views live behind More.
  it('renders a single-row 48px quiet header with secondary actions behind More', () => {
    const queryClient = new QueryClient({
      defaultOptions: {
        queries: { retry: false, gcTime: 0 },
        mutations: { retry: false },
      },
    });

    render(
      <QueryClientProvider client={queryClient}>
        <WorkspaceHeader
          ws={buildWorkspaceState()}
          dispatch={vi.fn()}
          activeView={'architecture' as ViewMode}
          setActiveView={vi.fn()}
        />
      </QueryClientProvider>,
    );

    const header = screen.getByTestId('workspace-header');
    // h-12 (Tailwind) = 48px per design-system token. We assert on the class
    // rather than computed style because jsdom does not apply Tailwind utilities.
    expect(header.className).toContain('h-12');
    expect(screen.getByTestId('header-row-main')).toBeInTheDocument();
    expect(screen.getByTestId('header-actions')).toBeInTheDocument();
    expect(screen.getByTestId('workspace-more-button')).toHaveAccessibleName('More workspace actions');
    expect(screen.queryByTestId('header-row-tools')).not.toBeInTheDocument();
  });

  it('secondary actions render visible text labels inside the More menu', () => {
    const queryClient = new QueryClient({
      defaultOptions: {
        queries: { retry: false, gcTime: 0 },
        mutations: { retry: false },
      },
    });

    render(
      <QueryClientProvider client={queryClient}>
        <WorkspaceHeader
          ws={buildWorkspaceState()}
          dispatch={vi.fn()}
          activeView={'architecture' as ViewMode}
          setActiveView={vi.fn()}
        />
      </QueryClientProvider>,
    );

    fireEvent.click(screen.getByTestId('workspace-more-button'));

    expect(screen.getByText('Quick actions')).toBeInTheDocument();
    expect(screen.getByText('More views')).toBeInTheDocument();
    expect(screen.getByText('Workspace actions')).toBeInTheDocument();
    expect(screen.getByText('Collaboration & updates')).toBeInTheDocument();
    expect(screen.getByText('Display')).toBeInTheDocument();

    expect(screen.getByTestId('quick-action-import')).toHaveTextContent('Import');
    expect(screen.getByTestId('quick-action-chat')).toHaveTextContent('chat');
    expect(screen.getByTestId('quick-action-hardware-inspection')).toHaveTextContent('Inspect hardware');

    expect(screen.getByTestId('pcb-tutorial-button')).toHaveTextContent('PCB Tutorial');
    expect(screen.getByTestId('toggle-activity-feed')).toHaveTextContent('Activity feed');
  });

  it('opens hardware inspection from the main header button and More menu', () => {
    const queryClient = new QueryClient({
      defaultOptions: {
        queries: { retry: false, gcTime: 0 },
        mutations: { retry: false },
      },
    });
    const onOpenHardwareInspection = vi.fn();

    render(
      <QueryClientProvider client={queryClient}>
        <WorkspaceHeader
          ws={buildWorkspaceState()}
          dispatch={vi.fn()}
          activeView={'architecture' as ViewMode}
          setActiveView={vi.fn()}
          onOpenHardwareInspection={onOpenHardwareInspection}
        />
      </QueryClientProvider>,
    );

    fireEvent.click(screen.getByTestId('workspace-open-hardware-inspection'));
    expect(onOpenHardwareInspection).toHaveBeenCalledTimes(1);

    fireEvent.click(screen.getByTestId('workspace-more-button'));
    fireEvent.click(screen.getByTestId('quick-action-hardware-inspection'));
    expect(onOpenHardwareInspection).toHaveBeenCalledTimes(2);
  });

  it('status controls are available in More and keep routing actions', () => {
    const queryClient = new QueryClient({
      defaultOptions: {
        queries: { retry: false, gcTime: 0 },
        mutations: { retry: false },
      },
    });

    render(
      <QueryClientProvider client={queryClient}>
        <WorkspaceHeader
          ws={buildWorkspaceState()}
          dispatch={vi.fn()}
          activeView={'architecture' as ViewMode}
          setActiveView={vi.fn()}
        />
      </QueryClientProvider>,
    );

    fireEvent.click(screen.getByTestId('workspace-more-button'));
    expect(screen.getByTestId('more-status-hardware')).toBeInTheDocument();
    expect(screen.getByTestId('more-status-health')).toBeInTheDocument();
  });

  it('opens the More menu, then opens Coach & Help and renders TutorialMenu content (E2E-074)', async () => {
    const queryClient = new QueryClient({
      defaultOptions: {
        queries: { retry: false, gcTime: 0 },
        mutations: { retry: false },
      },
    });

    render(
      <QueryClientProvider client={queryClient}>
        <WorkspaceHeader
          ws={buildWorkspaceState()}
          dispatch={vi.fn()}
          activeView={'architecture' as ViewMode}
          setActiveView={vi.fn()}
        />
      </QueryClientProvider>,
    );

    fireEvent.click(screen.getByTestId('workspace-more-button'));

    const trigger = screen.getByTestId('coach-help-button');
    // Radix PopoverTrigger sets aria-expanded on the underlying button.
    expect(trigger).toHaveAttribute('aria-expanded', 'false');

    fireEvent.click(trigger);

    expect(trigger).toHaveAttribute('aria-expanded', 'true');
    // The mocked TutorialMenu renders <div data-testid="tutorial-menu" />
    // inside the PopoverContent portal.
    const menu = await screen.findByTestId('tutorial-menu');
    expect(menu).toBeInTheDocument();
  });
});
