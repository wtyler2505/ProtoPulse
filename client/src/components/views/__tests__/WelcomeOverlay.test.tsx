import { beforeEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import WelcomeOverlay from '@/components/views/WelcomeOverlay';
import { BeginnerMode } from '@/lib/beginner-mode';
import { RolePresetManager } from '@/lib/role-presets';

describe('WelcomeOverlay', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    localStorage.clear();
    BeginnerMode.resetInstance();
    RolePresetManager.resetInstance();
  });

  it('renders the workspace mode chooser and updates the description when the role changes', () => {
    render(<WelcomeOverlay onNavigate={vi.fn()} onDismiss={vi.fn()} />);

    expect(screen.getByTestId('welcome-mode-panel')).toBeDefined();
    expect(screen.getByTestId('welcome-mode-description')).toHaveTextContent('Hobbyist');

    fireEvent.click(screen.getByTestId('role-preset-student'));

    expect(screen.getByTestId('welcome-mode-description')).toHaveTextContent('Student');
  });

  it('toggles plain-language labels from the welcome panel', () => {
    render(<WelcomeOverlay onNavigate={vi.fn()} onDismiss={vi.fn()} />);

    const toggle = screen.getByTestId('welcome-plain-labels-toggle');
    expect(toggle).toHaveTextContent('Use plain labels');

    fireEvent.click(toggle);

    expect(screen.getByTestId('welcome-plain-labels-toggle')).toHaveTextContent('Plain labels on');
  });

  it('routes quick-start actions to the requested view', () => {
    const onNavigate = vi.fn();
    render(<WelcomeOverlay onNavigate={onNavigate} onDismiss={vi.fn()} />);

    fireEvent.click(screen.getByTestId('welcome-step-validation-action'));

    expect(onNavigate).toHaveBeenCalledWith('validation');
  });

  it('lets the user dismiss the overlay from the close control or skip link', () => {
    const onDismiss = vi.fn();
    render(<WelcomeOverlay onNavigate={vi.fn()} onDismiss={onDismiss} />);

    fireEvent.click(screen.getByTestId('welcome-dismiss'));
    fireEvent.click(screen.getByTestId('welcome-skip'));

    expect(onDismiss).toHaveBeenCalledTimes(2);
  });
});
