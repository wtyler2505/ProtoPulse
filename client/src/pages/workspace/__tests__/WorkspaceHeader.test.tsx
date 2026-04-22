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

  it('shows the new workspace mode control and coach/help entry point', () => {
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

    expect(screen.getByTestId('workspace-health-badge')).toHaveTextContent('Saved + restore');
    expect(screen.getByTestId('workspace-health-badge')).toHaveAccessibleName('Open Design History');
    expect(screen.getByTestId('workspace-hardware-badge')).toHaveTextContent('Hardware ready');
    expect(screen.getByTestId('workspace-hardware-badge')).toHaveAccessibleName('Open Arduino workspace');
    expect(screen.getByTestId('workspace-mode-button')).toHaveTextContent('Hobbyist Mode');
    expect(screen.getByTestId('coach-help-button')).toHaveTextContent('Coach & Help');

    fireEvent.click(screen.getByTestId('workspace-hardware-badge'));
    expect(setActiveView).toHaveBeenCalledWith('arduino');

    fireEvent.click(screen.getByTestId('workspace-health-badge'));
    expect(setActiveView).toHaveBeenCalledWith('design_history');
  });

  // E2E-074 / Plan 02 Phase 1: clicking coach-help-button must open the popover and
  // reveal TutorialMenu content. NOTE: this test runs with StyledTooltip mocked as
  // a pass-through (see top of file), so it cannot detect the specific
  // `<PopoverTrigger asChild><StyledTooltip>` prop-forwarding regression. The real
  // click-truth assertion lives in e2e/p1-coach-popover.spec.ts. This unit test
  // documents the behavioral contract and guards against accidental removal of
  // the trigger or lazy-loaded content.
  it('opens the Coach & Help popover and renders TutorialMenu content on click (E2E-074)', async () => {
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
