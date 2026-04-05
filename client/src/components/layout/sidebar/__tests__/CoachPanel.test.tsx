import { beforeEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import CoachPanel from '@/components/layout/sidebar/CoachPanel';
import { BeginnerMode } from '@/lib/beginner-mode';
import { ChecklistManager } from '@/lib/first-run-checklist';
import { RolePresetManager } from '@/lib/role-presets';
import { ViewOnboardingManager } from '@/lib/view-onboarding';

const mockSetActiveView = vi.fn();

vi.mock('@/lib/contexts/project-id-context', () => ({
  useProjectId: () => 7,
}));

vi.mock('@/lib/contexts/project-meta-context', () => ({
  useProjectMeta: () => ({
    activeView: 'architecture',
    setActiveView: mockSetActiveView,
  }),
}));

vi.mock('@/lib/contexts/architecture-context', () => ({
  useArchitecture: () => ({
    nodes: [],
    edges: [],
  }),
}));

vi.mock('@/lib/contexts/bom-context', () => ({
  useBom: () => ({
    bom: [],
  }),
}));

vi.mock('@/lib/contexts/validation-context', () => ({
  useValidation: () => ({
    issues: [],
  }),
}));

describe('CoachPanel', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    localStorage.clear();
    BeginnerMode.resetInstance();
    ChecklistManager.resetInstance();
    RolePresetManager.resetInstance();
    ViewOnboardingManager.resetInstance();
  });

  it('renders the coach panel in hobbyist mode and routes quick actions through setActiveView', () => {
    render(<CoachPanel />);

    expect(screen.getByTestId('coach-panel')).toBeDefined();
    expect(screen.getByTestId('coach-role-description')).toHaveTextContent('Hobbyist mode');

    fireEvent.click(screen.getByTestId('coach-action-validation'));
    expect(mockSetActiveView).toHaveBeenCalledWith('validation');

    fireEvent.click(screen.getByTestId('coach-action-starter_circuits'));
    expect(mockSetActiveView).toHaveBeenCalledWith('starter_circuits');
  });

  it('lets the user hide and restore the beginner checklist without removing the whole coach panel', () => {
    render(<CoachPanel />);

    expect(screen.getByTestId('coach-progress-bar')).toBeDefined();

    fireEvent.click(screen.getByTestId('coach-dismiss-checklist'));

    expect(screen.getByTestId('coach-checklist-hidden')).toBeDefined();
    expect(screen.queryByTestId('coach-progress-bar')).toBeNull();
    expect(screen.getByTestId('coach-reset-checklist')).toBeDefined();

    fireEvent.click(screen.getByTestId('coach-reset-checklist'));

    expect(screen.queryByTestId('coach-checklist-hidden')).toBeNull();
    expect(screen.getByTestId('coach-progress-bar')).toBeDefined();
  });

  it('disappears entirely when the role is switched to pro mode', async () => {
    render(<CoachPanel />);

    fireEvent.click(screen.getByTestId('role-preset-pro'));

    await waitFor(() => {
      expect(screen.queryByTestId('coach-panel')).toBeNull();
    });
  });
});
