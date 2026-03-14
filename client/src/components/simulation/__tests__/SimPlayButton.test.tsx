import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import SimPlayButton from '../SimPlayButton';
import type { SimPlayButtonProps } from '../SimPlayButton';
import type { SimulationTypeResult } from '@/lib/simulation/auto-detect';

// Mock Radix DropdownMenu portals for happy-dom
vi.mock('@radix-ui/react-dropdown-menu', async () => {
  const actual = await vi.importActual<Record<string, unknown>>('@radix-ui/react-dropdown-menu');
  return {
    ...actual,
    Portal: ({ children }: { children: React.ReactNode }) => children,
  };
});

function renderButton(overrides: Partial<SimPlayButtonProps> = {}) {
  const defaultProps: SimPlayButtonProps = {
    isRunning: false,
    isStopping: false,
    detection: null,
    onStart: vi.fn(),
    onStop: vi.fn(),
    ...overrides,
  };
  return { ...render(<SimPlayButton {...defaultProps} />), props: defaultProps };
}

describe('SimPlayButton', () => {
  // ---------------------------------------------------------------------------
  // Play state (not running)
  // ---------------------------------------------------------------------------

  it('renders play button when not running', () => {
    renderButton();
    expect(screen.getByTestId('sim-play-button')).toBeTruthy();
  });

  it('renders play button text', () => {
    renderButton();
    expect(screen.getByTestId('sim-play-button').textContent).toContain('Start Simulation');
  });

  it('shows dropdown trigger when no detection', () => {
    renderButton({ detection: null });
    const btn = screen.getByTestId('sim-play-button');
    expect(btn).toBeTruthy();
  });

  // ---------------------------------------------------------------------------
  // Stop state (running)
  // ---------------------------------------------------------------------------

  it('renders stop button when running', () => {
    renderButton({ isRunning: true });
    const btn = screen.getByTestId('sim-stop-button');
    expect(btn).toBeTruthy();
    expect(btn.textContent).toContain('Stop');
  });

  it('calls onStop when stop button is clicked', () => {
    const onStop = vi.fn();
    renderButton({ isRunning: true, onStop });
    fireEvent.click(screen.getByTestId('sim-stop-button'));
    expect(onStop).toHaveBeenCalledOnce();
  });

  it('shows stopping state with disabled button', () => {
    renderButton({ isRunning: true, isStopping: true });
    const btn = screen.getByTestId('sim-stop-button') as HTMLButtonElement;
    expect(btn.disabled).toBe(true);
    expect(btn.textContent).toContain('Stopping');
  });

  // ---------------------------------------------------------------------------
  // High confidence detection — direct play
  // ---------------------------------------------------------------------------

  it('calls onStart with detected type on click when high confidence', () => {
    const onStart = vi.fn();
    const detection: SimulationTypeResult = {
      type: 'ac',
      confidence: 0.9,
      reason: 'AC sources detected',
    };
    renderButton({ detection, onStart });

    fireEvent.click(screen.getByTestId('sim-play-button'));
    expect(onStart).toHaveBeenCalledWith('ac');
  });

  it('maps dc type to dcop analysis type on start', () => {
    const onStart = vi.fn();
    const detection: SimulationTypeResult = {
      type: 'dc',
      confidence: 0.9,
      reason: 'DC sources only',
    };
    renderButton({ detection, onStart });

    fireEvent.click(screen.getByTestId('sim-play-button'));
    expect(onStart).toHaveBeenCalledWith('dcop');
  });

  it('maps transient type to transient analysis type on start', () => {
    const onStart = vi.fn();
    const detection: SimulationTypeResult = {
      type: 'transient',
      confidence: 0.85,
      reason: 'Pulse sources detected',
    };
    renderButton({ detection, onStart });

    fireEvent.click(screen.getByTestId('sim-play-button'));
    expect(onStart).toHaveBeenCalledWith('transient');
  });

  // ---------------------------------------------------------------------------
  // Type badge
  // ---------------------------------------------------------------------------

  it('shows type badge with high confidence detection', () => {
    const detection: SimulationTypeResult = {
      type: 'ac',
      confidence: 0.9,
      reason: 'AC sources detected',
    };
    renderButton({ detection });
    const badge = screen.getByTestId('sim-type-badge');
    expect(badge).toBeTruthy();
    expect(badge.textContent).toBe('AC');
  });

  it('shows DC badge label for dc type', () => {
    const detection: SimulationTypeResult = {
      type: 'dc',
      confidence: 0.9,
      reason: 'DC sources only',
    };
    renderButton({ detection });
    expect(screen.getByTestId('sim-type-badge').textContent).toBe('DC');
  });

  it('shows Transient badge label for transient type', () => {
    const detection: SimulationTypeResult = {
      type: 'transient',
      confidence: 0.85,
      reason: 'Pulse sources detected',
    };
    renderButton({ detection });
    expect(screen.getByTestId('sim-type-badge').textContent).toBe('Transient');
  });

  it('badge has title with reason for tooltip', () => {
    const detection: SimulationTypeResult = {
      type: 'ac',
      confidence: 0.9,
      reason: 'AC sources detected — frequency-domain analysis recommended',
    };
    renderButton({ detection });
    expect(screen.getByTestId('sim-type-badge').getAttribute('title')).toBe(detection.reason);
  });

  // ---------------------------------------------------------------------------
  // Low confidence / mixed — dropdown
  // ---------------------------------------------------------------------------

  it('shows dropdown trigger when confidence is below threshold', () => {
    const detection: SimulationTypeResult = {
      type: 'dc',
      confidence: 0.5,
      reason: 'Low confidence',
    };
    renderButton({ detection });
    const btn = screen.getByTestId('sim-play-button');
    expect(btn).toBeTruthy();
  });

  it('shows dropdown trigger for mixed type regardless of confidence', () => {
    const detection: SimulationTypeResult = {
      type: 'mixed',
      confidence: 0.8,
      reason: 'Multiple signal types',
    };
    renderButton({ detection });
    const btn = screen.getByTestId('sim-play-button');
    expect(btn).toBeTruthy();
  });

  it('does not call onStart directly when confidence < 0.7', () => {
    const onStart = vi.fn();
    const detection: SimulationTypeResult = {
      type: 'dc',
      confidence: 0.5,
      reason: 'Low confidence',
    };
    renderButton({ detection, onStart });

    fireEvent.click(screen.getByTestId('sim-play-button'));
    expect(onStart).not.toHaveBeenCalled();
  });

  it('shows Mixed badge for mixed type', () => {
    const detection: SimulationTypeResult = {
      type: 'mixed',
      confidence: 0.4,
      reason: 'Multiple signal types detected',
    };
    renderButton({ detection });
    const badge = screen.getByTestId('sim-type-badge');
    expect(badge.textContent).toBe('Mixed');
  });

  // ---------------------------------------------------------------------------
  // Edge cases
  // ---------------------------------------------------------------------------

  it('does not render stop button when not running', () => {
    renderButton({ isRunning: false });
    expect(screen.queryByTestId('sim-stop-button')).toBeNull();
  });

  it('does not render play button when running', () => {
    renderButton({ isRunning: true });
    expect(screen.queryByTestId('sim-play-button')).toBeNull();
  });

  it('does not show badge when no detection and not running', () => {
    renderButton({ detection: null });
    expect(screen.queryByTestId('sim-type-badge')).toBeNull();
  });

  it('confidence at exactly 0.7 triggers auto-start', () => {
    const onStart = vi.fn();
    const detection: SimulationTypeResult = {
      type: 'dc',
      confidence: 0.7,
      reason: 'At threshold',
    };
    renderButton({ detection, onStart });

    fireEvent.click(screen.getByTestId('sim-play-button'));
    expect(onStart).toHaveBeenCalledWith('dcop');
  });

  it('confidence at 0.69 shows dropdown instead of auto-start', () => {
    const onStart = vi.fn();
    const detection: SimulationTypeResult = {
      type: 'dc',
      confidence: 0.69,
      reason: 'Below threshold',
    };
    renderButton({ detection, onStart });

    fireEvent.click(screen.getByTestId('sim-play-button'));
    expect(onStart).not.toHaveBeenCalled();
  });
});
